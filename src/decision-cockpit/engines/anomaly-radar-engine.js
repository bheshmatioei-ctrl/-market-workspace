import { canonicalize } from "../contracts/serialization.js";
import {
  anomalyAlertId,
  canonicalAnomalyTypes,
  compareAnomalyTypes,
  discoveryCandidateId,
} from "../contracts/anomaly-discovery.js";
import { validateContract } from "../contracts/validators.js";
import {
  AnomalyType,
  EvidenceType,
  SCHEMA_VERSION,
  TrafficLight,
} from "../domain/constants.js";
import {
  assertEvaluationTime,
  confidence,
  createEngineMeta,
  deepFreeze,
  freshnessFromInputs,
  measurementValue,
} from "./engine-utils.js";
import { ANOMALY_RADAR_RULE_PROFILE } from "./rules/profiles.js";

const INTERPRETATIONS = Object.freeze({
  [AnomalyType.RELATIVE_VOLUME_SPIKE]: "Relative volume exceeded the experimental anomaly threshold; participation direction is not inferred.",
  [AnomalyType.ABNORMAL_DOLLAR_VOLUME]: "Observed dollar volume exceeded the experimental anomaly threshold; capital inflow or outflow is not inferred.",
  [AnomalyType.GAP_UP]: "An upward opening-price discontinuity exceeded the experimental threshold; continuation is not inferred.",
  [AnomalyType.GAP_DOWN]: "A downward opening-price discontinuity exceeded the experimental threshold; continuation is not inferred.",
  [AnomalyType.VWAP_RECLAIM]: "Price moved from at-or-below VWAP to above VWAP using a past-only prior observation; direction persistence is not inferred.",
  [AnomalyType.VWAP_BREAKDOWN]: "Price moved from at-or-above VWAP to below VWAP using a past-only prior observation; direction persistence is not inferred.",
  [AnomalyType.BREAKOUT]: "Price exceeded a past-only reference high by the experimental threshold; only the observed threshold crossing is recorded.",
  [AnomalyType.BREAKDOWN]: "Price fell below a past-only reference low by the experimental threshold; only the observed threshold crossing is recorded.",
  [AnomalyType.RELATIVE_STRENGTH_ACCELERATION]: "Relative strength increased against the same benchmark by the experimental threshold; persistence is not inferred.",
  [AnomalyType.RELATIVE_STRENGTH_DETERIORATION]: "Relative strength decreased against the same benchmark by the experimental threshold; persistence is not inferred.",
  [AnomalyType.SECTOR_CONFIRMATION]: "Current stock and sector movement are directionally aligned; the alignment is context only.",
  [AnomalyType.SECTOR_DIVERGENCE]: "Current stock movement lacks sector confirmation; opposition remains explicit.",
  [AnomalyType.PRICE_VOLUME_DIVERGENCE]: "Price and volume behavior do not confirm one another; both evidence families remain explicit.",
  [AnomalyType.CATALYST_ASSOCIATED_ANOMALY]: "An eligible normalized catalyst is temporally associated with detected abnormal activity; causation is not asserted.",
});

const compareStock = (left, right) => left.timestamp.localeCompare(right.timestamp) ||
  left.symbol.localeCompare(right.symbol) || left.snapshotId.localeCompare(right.snapshotId);
const compareSector = (left, right) => left.timestamp.localeCompare(right.timestamp) ||
  left.sectorId.localeCompare(right.sectorId) || left.snapshotId.localeCompare(right.snapshotId);
const compareCatalyst = (left, right) => left.timestamp.localeCompare(right.timestamp) || left.eventId.localeCompare(right.eventId);

function uniqueByIdentity(items, identityField, label) {
  const result = [];
  const byIdentity = new Map();
  for (const item of items) {
    const identity = item[identityField];
    const serialized = canonicalize(item);
    if (byIdentity.has(identity)) {
      if (byIdentity.get(identity) !== serialized) throw new Error(`Conflicting duplicate ${label} identity: ${identity}`);
      continue;
    }
    byIdentity.set(identity, serialized);
    result.push(item);
  }
  return result;
}

function sourceEligible(sourceMeta, evaluatedAt) {
  if (!sourceMeta || sourceMeta.isStale || sourceMeta.observedAt === null || sourceMeta.receivedAt === null) return false;
  const evaluatedMs = Date.parse(evaluatedAt);
  return Date.parse(sourceMeta.observedAt) <= evaluatedMs &&
    Date.parse(sourceMeta.receivedAt) <= evaluatedMs &&
    (sourceMeta.reportingPeriodEnd == null || Date.parse(sourceMeta.reportingPeriodEnd) <= evaluatedMs);
}

function fieldMatches(evidenceField, field) {
  return evidenceField === field || evidenceField === `${field}.value`;
}

function evidenceFor(snapshot, fields, evaluatedAt) {
  const required = new Set(fields);
  const evidence = (snapshot?.evidenceRefs ?? [])
    .filter((item) => [...required].some((field) => fieldMatches(item.field, field)))
    .filter((item) => sourceEligible(item.sourceMeta, evaluatedAt))
    .sort((left, right) => left.evidenceId.localeCompare(right.evidenceId));
  const covered = new Set();
  for (const item of evidence) {
    for (const field of required) if (fieldMatches(item.field, field)) covered.add(field);
  }
  return covered.size === required.size ? evidence : [];
}

function usableMeasurements(snapshot, fields, evaluatedAt) {
  const values = Object.fromEntries(fields.map((field) => [field, measurementValue(snapshot?.[field])]));
  if (!Object.values(values).every(Number.isFinite)) return null;
  const evidence = evidenceFor(snapshot, fields, evaluatedAt);
  if (evidence.length === 0) return null;
  return { values, evidence };
}

function uniqueEvidence(items) {
  return [...new Map(items.map((item) => [item.evidenceId, item])).values()]
    .sort((left, right) => left.evidenceId.localeCompare(right.evidenceId));
}

function sortedUniqueStrings(items) {
  return [...new Set(items)].sort((left, right) => left.localeCompare(right));
}

function catalystEvidence(event) {
  return deepFreeze({
    schemaVersion: SCHEMA_VERSION,
    evidenceId: `catalyst-event:${event.eventId}`,
    sourceMeta: event.sourceMeta,
    field: `catalystEvent.${event.eventId}.factualImpact`,
    value: event.factualImpact,
    unit: null,
    evidenceType: EvidenceType.DIRECT,
  });
}

function severityFor(anomalyCount, ruleProfile) {
  if (anomalyCount >= ruleProfile.severityByAnomalyCount.critical) return "critical";
  if (anomalyCount >= ruleProfile.severityByAnomalyCount.warning) return "warning";
  if (anomalyCount >= ruleProfile.severityByAnomalyCount.watch) return "watch";
  return "info";
}

function alertTrafficLight(candidate) {
  if (!candidate.freshness.decisionGrade) return TrafficLight.GREY;
  if (candidate.opposingEvidence.length > 0) return TrafficLight.ORANGE;
  return candidate.confidence.score >= 0.7 ? TrafficLight.GREEN : TrafficLight.ORANGE;
}

function latestSectorFor(sectorSnapshots, sectorId) {
  if (!sectorId) return null;
  return sectorSnapshots.filter((snapshot) => snapshot.sectorId === sectorId).at(-1) ?? null;
}

function eligibleCatalysts(catalystEvents, current, evaluatedAt, ruleProfile) {
  const evaluationMs = Date.parse(evaluatedAt);
  return catalystEvents.filter((event) => {
    if (!sourceEligible(event.sourceMeta, evaluatedAt)) return false;
    if (event.scheduled && Date.parse(event.scheduledAt) > evaluationMs) return false;
    const ageSeconds = (evaluationMs - Date.parse(event.timestamp)) / 1000;
    if (ageSeconds < 0 || ageSeconds > ruleProfile.catalystAssociationWindowSeconds) return false;
    return event.affectedSymbols.includes(current.symbol) ||
      (typeof current.sectorId === "string" && event.affectedSectors.includes(current.sectorId));
  });
}

function buildSymbolResult({ current, history, sectorSnapshots, catalystEvents, evaluatedAt, engineMeta, ruleProfile }) {
  if (!current.freshness?.decisionGrade) return null;

  const anomalies = new Map();
  const degradedBy = [];
  const record = (type, { supporting, opposing = [], snapshotIds, catalystIds = [] }) => {
    if (supporting.length === 0) return;
    const existing = anomalies.get(type) ?? { supporting: [], opposing: [], snapshotIds: [], catalystIds: [] };
    existing.supporting.push(...supporting);
    existing.opposing.push(...opposing);
    existing.snapshotIds.push(...snapshotIds);
    existing.catalystIds.push(...catalystIds);
    anomalies.set(type, existing);
  };

  const relativeVolume = usableMeasurements(current, ["relativeVolume"], evaluatedAt);
  if (relativeVolume && relativeVolume.values.relativeVolume >= ruleProfile.minimumRelativeVolume) {
    record(AnomalyType.RELATIVE_VOLUME_SPIKE, { supporting: relativeVolume.evidence, snapshotIds: [current.snapshotId] });
  }

  const dollarVolume = usableMeasurements(current, ["dollarVolume"], evaluatedAt);
  if (dollarVolume && dollarVolume.values.dollarVolume >= ruleProfile.abnormalDollarVolumeThreshold) {
    record(AnomalyType.ABNORMAL_DOLLAR_VOLUME, { supporting: dollarVolume.evidence, snapshotIds: [current.snapshotId] });
  }

  const gap = usableMeasurements(current, ["price", "priorClose"], evaluatedAt);
  if (gap && gap.values.priorClose !== 0) {
    const gapPct = ((gap.values.price / gap.values.priorClose) - 1) * 100;
    if (gapPct >= ruleProfile.gapThresholdPct) record(AnomalyType.GAP_UP, { supporting: gap.evidence, snapshotIds: [current.snapshotId] });
    if (gapPct <= -ruleProfile.gapThresholdPct) record(AnomalyType.GAP_DOWN, { supporting: gap.evidence, snapshotIds: [current.snapshotId] });
  }

  const previous = history.at(-1) ?? null;
  if (previous) {
    const currentVwap = usableMeasurements(current, ["price", "vwap", "distanceFromVWAPPct"], evaluatedAt);
    const previousVwap = usableMeasurements(previous, ["price", "vwap"], evaluatedAt);
    if (currentVwap && previousVwap) {
      const distance = Math.abs(currentVwap.values.distanceFromVWAPPct);
      if (distance >= ruleProfile.vwapDistanceThreshold && previousVwap.values.price <= previousVwap.values.vwap && currentVwap.values.price > currentVwap.values.vwap) {
        record(AnomalyType.VWAP_RECLAIM, { supporting: [...previousVwap.evidence, ...currentVwap.evidence], snapshotIds: [previous.snapshotId, current.snapshotId] });
      }
      if (distance >= ruleProfile.vwapDistanceThreshold && previousVwap.values.price >= previousVwap.values.vwap && currentVwap.values.price < currentVwap.values.vwap) {
        record(AnomalyType.VWAP_BREAKDOWN, { supporting: [...previousVwap.evidence, ...currentVwap.evidence], snapshotIds: [previous.snapshotId, current.snapshotId] });
      }
    }

    const currentStrength = usableMeasurements(current, ["relativeStrengthVsBenchmark"], evaluatedAt);
    const previousStrength = usableMeasurements(previous, ["relativeStrengthVsBenchmark"], evaluatedAt);
    if (currentStrength && previousStrength) {
      const strengthDelta = currentStrength.values.relativeStrengthVsBenchmark - previousStrength.values.relativeStrengthVsBenchmark;
      if (strengthDelta >= ruleProfile.relativeStrengthThreshold) {
        record(AnomalyType.RELATIVE_STRENGTH_ACCELERATION, { supporting: [...previousStrength.evidence, ...currentStrength.evidence], snapshotIds: [previous.snapshotId, current.snapshotId] });
      }
      if (strengthDelta <= -ruleProfile.relativeStrengthThreshold) {
        record(AnomalyType.RELATIVE_STRENGTH_DETERIORATION, { supporting: [...previousStrength.evidence, ...currentStrength.evidence], snapshotIds: [previous.snapshotId, current.snapshotId] });
      }
    }
  }

  if (history.length >= ruleProfile.minimumReferenceSnapshots) {
    const currentPrice = usableMeasurements(current, ["price"], evaluatedAt);
    const priorHighs = history.map((snapshot) => ({ snapshot, usable: usableMeasurements(snapshot, ["dayHigh"], evaluatedAt) })).filter((item) => item.usable);
    const priorLows = history.map((snapshot) => ({ snapshot, usable: usableMeasurements(snapshot, ["dayLow"], evaluatedAt) })).filter((item) => item.usable);
    if (currentPrice && priorHighs.length >= ruleProfile.minimumReferenceSnapshots) {
      const referenceHigh = Math.max(...priorHighs.map((item) => item.usable.values.dayHigh));
      if (currentPrice.values.price >= referenceHigh * (1 + (ruleProfile.breakoutThreshold / 100))) {
        record(AnomalyType.BREAKOUT, {
          supporting: [...currentPrice.evidence, ...priorHighs.flatMap((item) => item.usable.evidence)],
          snapshotIds: [current.snapshotId, ...priorHighs.map((item) => item.snapshot.snapshotId)],
        });
      }
    }
    if (currentPrice && priorLows.length >= ruleProfile.minimumReferenceSnapshots) {
      const referenceLow = Math.min(...priorLows.map((item) => item.usable.values.dayLow));
      if (currentPrice.values.price <= referenceLow * (1 - (ruleProfile.breakoutThreshold / 100))) {
        record(AnomalyType.BREAKDOWN, {
          supporting: [...currentPrice.evidence, ...priorLows.flatMap((item) => item.usable.evidence)],
          snapshotIds: [current.snapshotId, ...priorLows.map((item) => item.snapshot.snapshotId)],
        });
      }
    }
  }

  const priceVolume = usableMeasurements(current, ["changePct", "relativeVolume"], evaluatedAt);
  if (priceVolume) {
    const absolutePriceMove = Math.abs(priceVolume.values.changePct);
    if (absolutePriceMove >= ruleProfile.minimumPriceMovePctForDivergence &&
      priceVolume.values.relativeVolume <= ruleProfile.maximumRelativeVolumeForPriceConfirmation) {
      const priceEvidence = evidenceFor(current, ["changePct"], evaluatedAt);
      const volumeEvidence = evidenceFor(current, ["relativeVolume"], evaluatedAt);
      record(AnomalyType.PRICE_VOLUME_DIVERGENCE, { supporting: priceEvidence, opposing: volumeEvidence, snapshotIds: [current.snapshotId] });
    } else if (priceVolume.values.relativeVolume >= ruleProfile.minimumRelativeVolume &&
      absolutePriceMove <= ruleProfile.maximumPriceResponsePctForVolumeConfirmation) {
      const volumeEvidence = evidenceFor(current, ["relativeVolume"], evaluatedAt);
      const priceEvidence = evidenceFor(current, ["changePct"], evaluatedAt);
      record(AnomalyType.PRICE_VOLUME_DIVERGENCE, { supporting: volumeEvidence, opposing: priceEvidence, snapshotIds: [current.snapshotId] });
    }
  }

  const sector = latestSectorFor(sectorSnapshots, current.sectorId);
  const sectorFreshness = sector ? freshnessFromInputs([sector], evaluatedAt, "Sector-context freshness") : null;
  const stockMove = usableMeasurements(current, ["changePct"], evaluatedAt);
  const sectorMove = sector && sectorFreshness?.decisionGrade ? usableMeasurements(sector, ["priceChangePct"], evaluatedAt) : null;
  let resolvedSectorId = null;
  if (sector && sectorFreshness?.decisionGrade && sectorMove) {
    resolvedSectorId = sector.sectorId;
    const stockValue = stockMove?.values.changePct;
    const sectorValue = sectorMove.values.priceChangePct;
    if (Number.isFinite(stockValue) && Math.abs(stockValue) >= ruleProfile.minimumStockMovePctForSectorContext) {
      const sameDirection = Math.sign(stockValue) === Math.sign(sectorValue) && Math.sign(stockValue) !== 0;
      if (sameDirection && Math.abs(sectorValue) >= ruleProfile.minimumSectorMovePct) {
        record(AnomalyType.SECTOR_CONFIRMATION, { supporting: [...stockMove.evidence, ...sectorMove.evidence], snapshotIds: [current.snapshotId, sector.snapshotId] });
      } else if (!sameDirection || Math.abs(sectorValue) < ruleProfile.minimumSectorMovePct) {
        record(AnomalyType.SECTOR_DIVERGENCE, { supporting: stockMove.evidence, opposing: sectorMove.evidence, snapshotIds: [current.snapshotId, sector.snapshotId] });
      }
    }
  } else if (current.sectorId) {
    degradedBy.push(sector ? "Sector context is stale or lacks eligible provenance." : "Matching sector context is missing.");
  }

  const catalysts = eligibleCatalysts(catalystEvents, current, evaluatedAt, ruleProfile);
  if (anomalies.size > 0 && catalysts.length > 0) {
    record(AnomalyType.CATALYST_ASSOCIATED_ANOMALY, {
      supporting: catalysts.map(catalystEvidence),
      snapshotIds: [current.snapshotId],
      catalystIds: catalysts.map((event) => event.eventId),
    });
  } else if (anomalies.size > 0 && catalysts.length === 0) {
    degradedBy.push("No qualifying catalyst was supplied; absence is not proof that no catalyst exists.");
  }

  if (anomalies.size === 0) return null;
  const anomalyTypes = canonicalAnomalyTypes([...anomalies.keys()]);
  const supportingEvidence = uniqueEvidence(anomalyTypes.flatMap((type) => anomalies.get(type).supporting));
  const opposingEvidence = uniqueEvidence(anomalyTypes.flatMap((type) => anomalies.get(type).opposing));
  const sourceSnapshotIds = sortedUniqueStrings([current.snapshotId, ...anomalyTypes.flatMap((type) => anomalies.get(type).snapshotIds)]);
  const catalystEventIds = sortedUniqueStrings(anomalyTypes.flatMap((type) => anomalies.get(type).catalystIds));
  const usedCurrentInputs = [current, ...(resolvedSectorId ? [sector] : []), ...catalysts];
  const freshness = freshnessFromInputs(usedCurrentInputs, evaluatedAt, "Anomaly-radar input freshness");
  const evidenceFamilies = new Set(supportingEvidence.map((item) => item.field.split(".")[0])).size;
  const candidateConfidence = confidence({
    coverage: Math.min(1, evidenceFamilies / ruleProfile.minimumEvidenceFamilies),
    conflicts: opposingEvidence.length > 0 ? 1 : 0,
    freshness,
    reasons: [`${anomalyTypes.length} deterministic anomaly class(es) preserved from ${evidenceFamilies} evidence family/families.`],
    degradedBy,
  });
  const candidate = deepFreeze({
    schemaVersion: SCHEMA_VERSION,
    candidateId: discoveryCandidateId({
      engineVersion: engineMeta.engineVersion,
      ruleProfileId: engineMeta.ruleProfileId,
      timestamp: evaluatedAt,
      symbol: current.symbol,
    }),
    timestamp: evaluatedAt,
    symbol: current.symbol,
    anomalyTypes,
    severity: severityFor(anomalyTypes.length, ruleProfile),
    confidence: candidateConfidence,
    supportingEvidence,
    opposingEvidence,
    catalystEventIds,
    sectorId: resolvedSectorId,
    sourceSnapshotIds,
    freshness,
    engineMeta,
  });
  validateContract("DiscoveryCandidate", candidate);

  const alerts = anomalyTypes.map((type) => {
    const anomaly = anomalies.get(type);
    const rawEvidence = uniqueEvidence([...anomaly.supporting, ...anomaly.opposing]);
    const alert = deepFreeze({
      schemaVersion: SCHEMA_VERSION,
      alertId: anomalyAlertId({
        engineVersion: engineMeta.engineVersion,
        ruleProfileId: engineMeta.ruleProfileId,
        evaluatedAt,
        symbol: current.symbol,
        anomalyType: type,
      }),
      createdAt: evaluatedAt,
      type,
      severity: candidate.severity,
      symbol: current.symbol,
      sector: resolvedSectorId,
      marketWide: false,
      rawEvidence,
      interpretation: INTERPRETATIONS[type],
      trafficLight: alertTrafficLight(candidate),
      confidence: candidateConfidence,
      expiresAt: null,
      modelVersion: engineMeta.engineVersion,
    });
    validateContract("Alert", alert);
    return alert;
  });

  return { candidate, alerts };
}

export function evaluateAnomalyRadar({
  stockSnapshots = [],
  sectorSnapshots = [],
  catalystEvents = [],
  evaluatedAt,
  ruleProfile = ANOMALY_RADAR_RULE_PROFILE,
}) {
  stockSnapshots.forEach((snapshot) => validateContract("StockSnapshot", snapshot));
  sectorSnapshots.forEach((snapshot) => validateContract("SectorSnapshot", snapshot));
  catalystEvents.forEach((event) => validateContract("CatalystEvent", event));
  assertEvaluationTime(evaluatedAt, [...stockSnapshots, ...sectorSnapshots, ...catalystEvents]);

  const stocks = uniqueByIdentity([...stockSnapshots].sort(compareStock), "snapshotId", "StockSnapshot");
  const sectors = uniqueByIdentity([...sectorSnapshots].sort(compareSector), "snapshotId", "SectorSnapshot");
  const catalysts = uniqueByIdentity([...catalystEvents].sort(compareCatalyst), "eventId", "CatalystEvent");
  const engineMeta = createEngineMeta(ruleProfile, evaluatedAt, {
    StockSnapshot: stocks[0]?.schemaVersion ?? SCHEMA_VERSION,
    SectorSnapshot: sectors[0]?.schemaVersion ?? SCHEMA_VERSION,
    CatalystEvent: catalysts[0]?.schemaVersion ?? SCHEMA_VERSION,
    DiscoveryCandidate: SCHEMA_VERSION,
    Alert: SCHEMA_VERSION,
  });

  const bySymbol = new Map();
  for (const snapshot of stocks) {
    if (!bySymbol.has(snapshot.symbol)) bySymbol.set(snapshot.symbol, []);
    bySymbol.get(snapshot.symbol).push(snapshot);
  }

  const results = [];
  for (const symbol of [...bySymbol.keys()].sort((left, right) => left.localeCompare(right))) {
    const snapshots = bySymbol.get(symbol);
    const current = snapshots.at(-1);
    const history = snapshots.filter((snapshot) => Date.parse(snapshot.timestamp) < Date.parse(current.timestamp));
    const result = buildSymbolResult({ current, history, sectorSnapshots: sectors, catalystEvents: catalysts, evaluatedAt, engineMeta, ruleProfile });
    if (result) results.push(result);
  }

  const discoveryCandidates = results.map((item) => item.candidate)
    .sort((left, right) => left.symbol.localeCompare(right.symbol) || left.candidateId.localeCompare(right.candidateId));
  const alerts = results.flatMap((item) => item.alerts)
    .sort((left, right) => left.symbol.localeCompare(right.symbol) || compareAnomalyTypes(left.type, right.type) || left.alertId.localeCompare(right.alertId));

  return deepFreeze({ engineMeta, alerts, discoveryCandidates });
}
