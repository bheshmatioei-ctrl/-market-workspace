import { canonicalize } from "../contracts/serialization.js";
import {
  PREMARKET_WINDOW_ORDER,
  premarketAssessmentId,
  premarketSnapshotId,
} from "../contracts/premarket-intelligence.js";
import { validateContract } from "../contracts/validators.js";
import {
  CatalystImpactTier,
  DirectionState,
  EvidenceType,
  FreshnessStatus,
  FuturesInstrument,
  LiquidityQuality,
  ParticipationProxyState,
  PremarketFreezeStatus,
  PremarketWindow,
  SCHEMA_VERSION,
  SessionPhase,
  TrafficLight,
} from "../domain/constants.js";
import {
  assertEvaluationTime,
  confidence,
  createEngineMeta,
  deepFreeze,
  freshnessFromInputs,
  measurementValue,
  round,
} from "./engine-utils.js";
import { PREMARKET_INTELLIGENCE_RULE_PROFILE } from "./rules/profiles.js";

const lexicalCompare = (left, right) => left < right ? -1 : left > right ? 1 : 0;
const inputId = (input) => input?.snapshotId ?? input?.eventId ?? input?.assessmentId ?? input?.candidateId ?? "unknown-input";
const windowToPhase = Object.freeze({
  [PremarketWindow.AFTERHOURS]: SessionPhase.AFTERHOURS,
  [PremarketWindow.OVERNIGHT]: SessionPhase.OVERNIGHT,
  [PremarketWindow.PREMARKET]: SessionPhase.PREMARKET,
});
const liquidityRank = Object.freeze({
  [LiquidityQuality.INSUFFICIENT]: 0,
  [LiquidityQuality.LOW]: 1,
  [LiquidityQuality.MEDIUM]: 2,
  [LiquidityQuality.HIGH]: 3,
});

function uniqueEvidence(evidence) {
  return [...new Map(evidence.map((item) => [item.evidenceId, item])).values()]
    .sort((left, right) => lexicalCompare(left.evidenceId, right.evidenceId));
}

function uniqueStrings(items) {
  return [...new Set(items)].sort(lexicalCompare);
}

function allEvidence(input) {
  return [
    ...(input?.evidenceRefs ?? []),
    ...(input?.supportingEvidence ?? []),
    ...(input?.opposingEvidence ?? []),
    ...(input?.directEvidence ?? []),
    ...(input?.proxyEvidence ?? []),
  ];
}

function uniqueByIdentity(items, label) {
  const results = [];
  const seen = new Map();
  for (const item of items) {
    const identity = inputId(item);
    const serialized = canonicalize(item);
    if (seen.has(identity)) {
      if (seen.get(identity) !== serialized) throw new Error(`Conflicting duplicate ${label} identity: ${identity}`);
      continue;
    }
    seen.set(identity, serialized);
    results.push(item);
  }
  return results;
}

function sourceEligible(sourceMeta) {
  return sourceMeta && !sourceMeta.isStale && sourceMeta.observedAt !== null && sourceMeta.receivedAt !== null;
}

function fieldMatches(actual, expected) {
  return actual === expected || actual === `${expected}.value`;
}

function evidenceFor(input, fields) {
  const requested = new Set(fields);
  const evidence = allEvidence(input)
    .filter((item) => sourceEligible(item.sourceMeta))
    .filter((item) => [...requested].some((field) => fieldMatches(item.field, field)))
    .sort((left, right) => lexicalCompare(left.evidenceId, right.evidenceId));
  const covered = new Set();
  for (const item of evidence) {
    for (const field of requested) if (fieldMatches(item.field, field)) covered.add(field);
  }
  return covered.size === requested.size ? evidence : [];
}

function asPremarketProxy(evidence, family, window) {
  return deepFreeze({
    ...structuredClone(evidence),
    evidenceId: `premarket:${window}:${family}:${evidence.evidenceId}`,
    field: `premarketProxy.${family}.${evidence.field}`,
    evidenceType: EvidenceType.DERIVED,
  });
}

function catalystEvidence(event, role) {
  return deepFreeze({
    schemaVersion: SCHEMA_VERSION,
    evidenceId: `premarket:catalyst:${role}:${event.eventId}`,
    sourceMeta: event.sourceMeta,
    field: `catalystEvent.${event.eventId}.${role}`,
    value: event.impactTier ?? "UNKNOWN",
    unit: null,
    evidenceType: EvidenceType.DIRECT,
  });
}

function participationEvidence(stock, state) {
  const basis = evidenceFor(stock, ["gapPct", "relativePremarketVolume"])[0];
  if (!basis) return null;
  return deepFreeze({
    schemaVersion: SCHEMA_VERSION,
    evidenceId: `premarket:participation:${stock.symbol}:${stock.snapshotId}`,
    sourceMeta: basis.sourceMeta,
    field: "participationProxyState",
    value: state,
    unit: null,
    evidenceType: EvidenceType.DERIVED,
  });
}

function assertEvidenceTime(input, evaluatedAt) {
  const evaluatedMs = Date.parse(evaluatedAt);
  for (const evidence of allEvidence(input)) {
    const source = evidence.sourceMeta;
    if (!source) continue;
    if (source.observedAt !== null && Date.parse(source.observedAt) > evaluatedMs) throw new Error(`Future source observation is forbidden: ${source.sourceId}`);
    if (source.receivedAt !== null && Date.parse(source.receivedAt) > evaluatedMs) throw new Error(`Future source receipt is forbidden: ${source.sourceId}`);
    if (source.reportingPeriodEnd != null && Date.parse(source.reportingPeriodEnd) > evaluatedMs) throw new Error(`Future reporting period is forbidden: ${source.sourceId}`);
  }
  if (input?.freshness?.assessedAt && Date.parse(input.freshness.assessedAt) > evaluatedMs) {
    throw new Error(`Future freshness assessment is forbidden: ${inputId(input)}`);
  }
  if (input?.engineMeta?.evaluatedAt && Date.parse(input.engineMeta.evaluatedAt) > evaluatedMs) {
    throw new Error(`Future engine evaluation is forbidden: ${inputId(input)}`);
  }
}

export function classifyPremarketWindow(timestamp, boundary) {
  const time = Date.parse(timestamp);
  if (!Number.isFinite(time)) throw new TypeError("timestamp must be a UTC timestamp");
  const priorClose = Date.parse(boundary.priorRegularCloseTimestamp);
  const afterhoursEnd = Date.parse(boundary.afterhoursEndTimestamp);
  const premarketStart = Date.parse(boundary.premarketStartTimestamp);
  const regularOpen = Date.parse(boundary.regularOpenTimestamp);
  if (time >= priorClose && time < afterhoursEnd) return PremarketWindow.AFTERHOURS;
  if (time >= afterhoursEnd && time < premarketStart) return PremarketWindow.OVERNIGHT;
  if (time >= premarketStart && time < regularOpen) return PremarketWindow.PREMARKET;
  return null;
}

function assertSessionIdentity(input, boundary) {
  const identity = input.sessionIdentity;
  if (!identity) throw new Error(`Missing SessionIdentity: ${inputId(input)}`);
  if (identity.sessionDate !== boundary.sessionDate) throw new Error(`Session date mismatch: ${inputId(input)}`);
  if (identity.sessionCalendarId !== boundary.sessionCalendarId) throw new Error(`Session calendar mismatch: ${inputId(input)}`);
  if (identity.sessionPhase === SessionPhase.REGULAR) throw new Error(`Regular-session evidence is forbidden: ${inputId(input)}`);
  const window = classifyPremarketWindow(input.timestamp, boundary);
  if (window === null) {
    if (Date.parse(input.timestamp) >= Date.parse(boundary.regularOpenTimestamp)) throw new Error(`Post-open evidence is forbidden: ${inputId(input)}`);
    throw new Error(`Input is outside the explicit session boundary: ${inputId(input)}`);
  }
  if (identity.sessionPhase !== windowToPhase[window]) throw new Error(`Session phase contradicts explicit boundary: ${inputId(input)}`);
  return window;
}

function isFreshEnough(input, maximumAgeSeconds = null) {
  if (input?.freshness) {
    if (!input.freshness.decisionGrade) return false;
    if ([FreshnessStatus.STALE, FreshnessStatus.UNAVAILABLE].includes(input.freshness.status)) return false;
    return maximumAgeSeconds === null || input.freshness.ageSeconds === null || input.freshness.ageSeconds <= maximumAgeSeconds;
  }
  const sources = allEvidence(input).map((item) => item.sourceMeta).filter(Boolean);
  if (!sources.length || sources.some((item) => !sourceEligible(item))) return false;
  return maximumAgeSeconds === null || sources.every((item) => item.freshnessSeconds === null || item.freshnessSeconds <= maximumAgeSeconds);
}

function signal({ value, family, input, fields, window }) {
  if (!Number.isFinite(value) || value === 0) return null;
  const evidence = evidenceFor(input, fields);
  if (!evidence.length) return null;
  return {
    value: Math.sign(value),
    magnitude: Math.abs(value),
    family,
    inputId: inputId(input),
    evidence: evidence.map((item) => asPremarketProxy(item, family, window)),
  };
}

function futuresSignals(inputs, window, ruleProfile, degradedBy) {
  const signals = [];
  const observed = new Set();
  for (const input of inputs) {
    observed.add(input.instrument);
    if (!isFreshEnough(input, ruleProfile.maximumFuturesAgeSeconds)) {
      degradedBy.push(`Futures ${input.instrument} is stale or not decision-grade.`);
      continue;
    }
    const value = measurementValue(input.changePctFromPriorCashClose);
    const next = signal({ value, family: `futures.${input.instrument}`, input, fields: ["changePctFromPriorCashClose"], window });
    if (next) signals.push(next);
    else degradedBy.push(`Futures ${input.instrument} change evidence is missing or neutral.`);
  }
  const missing = Object.values(FuturesInstrument).filter((instrument) => !observed.has(instrument));
  if (missing.length) degradedBy.push(`Missing futures component(s): ${missing.join(", ")}.`);
  if (observed.size < ruleProfile.minimumFuturesEvidenceFamilies) degradedBy.push("Minimum futures evidence families not met.");
  if (signals.some((item) => item.value > 0) && signals.some((item) => item.value < 0) &&
    signals.some((item) => item.magnitude >= ruleProfile.futuresConflictMagnitude)) {
    degradedBy.push("ES/NQ/RTY conflict exceeded the experimental futures conflict magnitude.");
  }
  return signals;
}

function marketSignals(inputs, window, degradedBy) {
  if (inputs.length < 2) {
    if (inputs.length) degradedBy.push("Market direction requires at least two same-window snapshots.");
    return [];
  }
  const first = inputs[0];
  const last = inputs.at(-1);
  if (!isFreshEnough(first) || !isFreshEnough(last)) {
    degradedBy.push("Market context is stale or not decision-grade.");
    return [];
  }
  const signals = [];
  for (const field of ["spy", "qqq", "iwm", "dia"]) {
    const start = measurementValue(first[field]);
    const end = measurementValue(last[field]);
    if (!Number.isFinite(start) || !Number.isFinite(end) || start === 0) continue;
    const next = signal({ value: ((end / start) - 1) * 100, family: `market.${field}`, input: last, fields: [field], window });
    if (next) {
      const earlier = evidenceFor(first, [field]).map((item) => asPremarketProxy(item, `market.${field}.reference`, window));
      next.evidence = uniqueEvidence([...earlier, ...next.evidence]);
      next.inputId = `${first.snapshotId}|${last.snapshotId}`;
      signals.push(next);
    }
  }
  return signals;
}

function sectorSignals(inputs, window, ruleProfile, degradedBy) {
  const signals = [];
  for (const input of inputs) {
    if (!isFreshEnough(input, ruleProfile.maximumSectorAgeSeconds)) {
      degradedBy.push(`Sector ${input.sectorId} is stale or not decision-grade.`);
      continue;
    }
    const next = signal({ value: measurementValue(input.priceChangePct), family: `sector.${input.sectorId}`, input, fields: ["priceChangePct"], window });
    if (next) signals.push(next);
  }
  return signals;
}

function stockSignals(inputs, window, ruleProfile, degradedBy) {
  const signals = [];
  for (const input of inputs) {
    if (!isFreshEnough(input, ruleProfile.maximumPremarketStockAgeSeconds)) {
      degradedBy.push(`Premarket stock ${input.symbol} is stale or not decision-grade.`);
      continue;
    }
    if (input.liquidityQuality === LiquidityQuality.INSUFFICIENT) {
      degradedBy.push(`Premarket stock ${input.symbol} has insufficient liquidity.`);
      continue;
    }
    if (input.liquidityQuality === LiquidityQuality.LOW) degradedBy.push(`Premarket stock ${input.symbol} has LOW liquidity.`);
    const gap = measurementValue(input.gapPct);
    const relativeVolume = measurementValue(input.relativePremarketVolume);
    if (!Number.isFinite(gap) || !Number.isFinite(relativeVolume) || relativeVolume <= 0) {
      degradedBy.push(`Premarket stock ${input.symbol} lacks comparable gap/relative-volume evidence.`);
      continue;
    }
    const next = signal({ value: gap, family: `stock.${input.symbol}`, input, fields: ["gapPct", "relativePremarketVolume"], window });
    if (next) signals.push(next);
  }
  return signals;
}

function globalSignals(inputs, window, ruleProfile, degradedBy) {
  const eligible = inputs.filter((input) => ["overnight", "1d"].includes(input.horizon));
  const excluded = inputs.filter((input) => !["overnight", "1d"].includes(input.horizon));
  if (excluded.length) degradedBy.push("Long-horizon global context retained with its true label and excluded from overnight flow.");
  if (eligible.length < ruleProfile.minimumGlobalContextFamilies && inputs.length) degradedBy.push("Minimum short-horizon global context families not met.");
  const signals = [];
  for (const input of eligible) {
    if (!isFreshEnough(input)) {
      degradedBy.push(`Global context ${input.countryOrRegion}/${input.horizon} is stale.`);
      continue;
    }
    const value = input.trafficLight === TrafficLight.GREEN ? 1 : input.trafficLight === TrafficLight.RED ? -1 : 0;
    const evidence = input.proxyEvidence.filter((item) => sourceEligible(item.sourceMeta));
    if (!value || !evidence.length) continue;
    signals.push({
      value,
      magnitude: Math.abs(input.score ?? value),
      family: `global.${input.countryOrRegion}.${input.horizon}`,
      inputId: input.assessmentId,
      evidence: evidence.map((item) => asPremarketProxy(item, `global.${input.countryOrRegion}.${input.horizon}`, window)),
    });
  }
  return signals;
}

function classifySignals(signals) {
  const positive = signals.filter((item) => item.value > 0);
  const negative = signals.filter((item) => item.value < 0);
  if (!positive.length && !negative.length) return { state: TrafficLight.GREY, direction: DirectionState.UNKNOWN, positive, negative };
  if (positive.length && negative.length) {
    const direction = positive.length > negative.length ? DirectionState.IMPROVING :
      negative.length > positive.length ? DirectionState.DETERIORATING : DirectionState.STABLE;
    return { state: TrafficLight.ORANGE, direction, positive, negative };
  }
  if (positive.length) return { state: TrafficLight.GREEN, direction: DirectionState.IMPROVING, positive, negative };
  return { state: TrafficLight.RED, direction: DirectionState.DETERIORATING, positive, negative };
}

function cappedConfidence(base, cap, degradedBy = []) {
  return deepFreeze({
    ...base,
    score: round(Math.min(base.score, cap)),
    degradedBy: uniqueStrings([...base.degradedBy, ...degradedBy]),
  });
}

function buildWindowAssessment({ window, bucket, engineMeta, boundary, ruleProfile }) {
  const degradedBy = [];
  const signals = [
    ...futuresSignals(bucket.futures, window, ruleProfile, degradedBy),
    ...marketSignals(bucket.markets, window, degradedBy),
    ...sectorSignals(bucket.sectors, window, ruleProfile, degradedBy),
    ...stockSignals(bucket.stocks, window, ruleProfile, degradedBy),
    ...globalSignals(bucket.global, window, ruleProfile, degradedBy),
  ];
  const classification = classifySignals(signals);
  const supportingSignals = classification.direction === DirectionState.DETERIORATING ? classification.negative : classification.positive;
  const opposingSignals = classification.direction === DirectionState.DETERIORATING ? classification.positive : classification.negative;
  const releasedEvidence = bucket.catalysts
    .filter((event) => !event.scheduled || Date.parse(event.timestamp) >= Date.parse(event.scheduledAt))
    .map((event) => catalystEvidence(event, "released"));
  const supportingEvidence = uniqueEvidence([...supportingSignals.flatMap((item) => item.evidence), ...releasedEvidence]);
  const opposingEvidence = uniqueEvidence(opposingSignals.flatMap((item) => item.evidence));
  const inputs = [...bucket.futures, ...bucket.markets, ...bucket.stocks, ...bucket.sectors, ...bucket.catalysts, ...bucket.global];
  const freshness = freshnessFromInputs(inputs, engineMeta.evaluatedAt, `${window} input freshness`);
  const families = new Set(signals.map((item) => item.family)).size;
  const conflict = classification.positive.length > 0 && classification.negative.length > 0;
  let assessmentConfidence = confidence({
    coverage: Math.min(1, families / ruleProfile.minimumFuturesEvidenceFamilies),
    conflicts: conflict ? 1 : 0,
    freshness,
    reasons: [`${families} independent ${window} evidence family/families evaluated without cross-window averaging.`],
    degradedBy,
  });
  if (bucket.stocks.some((item) => item.liquidityQuality === LiquidityQuality.LOW)) {
    assessmentConfidence = cappedConfidence(assessmentConfidence, 0.69, ["LOW premarket liquidity caps confidence below high confidence."]);
  }
  if (bucket.stocks.some((item) => item.liquidityQuality === LiquidityQuality.INSUFFICIENT)) {
    assessmentConfidence = cappedConfidence(assessmentConfidence, 0.49, ["INSUFFICIENT premarket liquidity cannot support high confidence."]);
  }
  if (classification.state === TrafficLight.GREY) {
    assessmentConfidence = cappedConfidence(assessmentConfidence, 0.35, ["Directional evidence is insufficient; missing is not neutral."]);
  }
  const sourceSnapshotIds = uniqueStrings(inputs.map(inputId));
  const output = deepFreeze({
    schemaVersion: SCHEMA_VERSION,
    assessmentId: premarketAssessmentId({
      engineVersion: engineMeta.engineVersion,
      ruleProfileId: engineMeta.ruleProfileId,
      evaluatedAt: engineMeta.evaluatedAt,
      sessionDate: boundary.sessionDate,
      sessionCalendarId: boundary.sessionCalendarId,
      window,
    }),
    timestamp: engineMeta.evaluatedAt,
    window,
    state: classification.state,
    direction: classification.direction,
    confidence: assessmentConfidence,
    freshness,
    supportingEvidence,
    opposingEvidence,
    sourceSnapshotIds,
    engineMeta,
  });
  validateContract("PremarketWindowAssessment", output);
  return output;
}

function participationAssessment(stocks, ruleProfile) {
  const degradedBy = [];
  const eligible = stocks.filter((stock) => {
    if (!isFreshEnough(stock, ruleProfile.maximumPremarketStockAgeSeconds)) return false;
    if (liquidityRank[stock.liquidityQuality] < liquidityRank[ruleProfile.minimumLiquidityQuality]) return false;
    const gap = measurementValue(stock.gapPct);
    const relativeVolume = measurementValue(stock.relativePremarketVolume);
    return Number.isFinite(gap) && Number.isFinite(relativeVolume) && relativeVolume > 0 && evidenceFor(stock, ["gapPct", "relativePremarketVolume"]).length > 0;
  });
  const positive = eligible.filter((stock) => measurementValue(stock.gapPct) > 0);
  const negative = eligible.filter((stock) => measurementValue(stock.gapPct) < 0);
  const neutral = eligible.filter((stock) => measurementValue(stock.gapPct) === 0);
  let state = ParticipationProxyState.INSUFFICIENT;
  if (eligible.length >= ruleProfile.participationMinimumFamilies && positive.length === eligible.length) state = ParticipationProxyState.BROAD_DEMAND_PROXY;
  else if (eligible.length >= ruleProfile.participationMinimumFamilies && negative.length === eligible.length) state = ParticipationProxyState.BROAD_SELLING_PRESSURE_PROXY;
  else if (positive.length && negative.length) state = ParticipationProxyState.MIXED;
  else if (positive.length === 1 && negative.length === 0 && neutral.length > 0) state = ParticipationProxyState.CONCENTRATED_DEMAND;
  else if (negative.length === 1 && positive.length === 0 && neutral.length > 0) state = ParticipationProxyState.CONCENTRATED_SELLING;
  if (eligible.length < ruleProfile.participationMinimumFamilies) degradedBy.push("Minimum participation evidence families not met.");
  if (stocks.some((stock) => stock.liquidityQuality === LiquidityQuality.LOW)) degradedBy.push("LOW-liquidity stock evidence excluded from broad participation classification.");
  if (stocks.some((stock) => stock.liquidityQuality === LiquidityQuality.INSUFFICIENT)) degradedBy.push("INSUFFICIENT-liquidity stock evidence excluded from participation classification.");
  const evidence = uniqueEvidence(eligible.map((stock) => participationEvidence(stock, state)).filter(Boolean));
  return { state, evidence, degradedBy };
}

function proxyTrafficLight(state) {
  if (state === ParticipationProxyState.BROAD_DEMAND_PROXY) return TrafficLight.GREEN;
  if (state === ParticipationProxyState.BROAD_SELLING_PRESSURE_PROXY) return TrafficLight.RED;
  if ([ParticipationProxyState.CONCENTRATED_DEMAND, ParticipationProxyState.CONCENTRATED_SELLING, ParticipationProxyState.MIXED].includes(state)) return TrafficLight.ORANGE;
  return TrafficLight.GREY;
}

function globalTrafficLight(globalAssessments) {
  const eligible = globalAssessments.filter((item) => ["overnight", "1d"].includes(item.horizon) && isFreshEnough(item));
  const states = eligible.map((item) => item.trafficLight).filter((item) => item !== TrafficLight.GREY);
  if (!states.length) return TrafficLight.GREY;
  if (states.includes(TrafficLight.GREEN) && states.includes(TrafficLight.RED)) return TrafficLight.ORANGE;
  if (states.every((item) => item === TrafficLight.GREEN)) return TrafficLight.GREEN;
  if (states.every((item) => item === TrafficLight.RED)) return TrafficLight.RED;
  return TrafficLight.ORANGE;
}

function futuresTrafficLight(buckets, ruleProfile) {
  for (const window of [...PREMARKET_WINDOW_ORDER].reverse()) {
    if (!buckets[window].futures.length) continue;
    const signals = futuresSignals(buckets[window].futures, window, ruleProfile, []);
    return classifySignals(signals).state;
  }
  return TrafficLight.GREY;
}

function compositeTrafficLight(windowAssessments, globalState, macroRiskState) {
  const states = [...windowAssessments.map((item) => item.state), globalState]
    .filter((state) => state !== TrafficLight.GREY);
  if (!states.length) return TrafficLight.GREY;
  if (states.includes(TrafficLight.GREEN) && states.includes(TrafficLight.RED)) return TrafficLight.ORANGE;
  if (macroRiskState === TrafficLight.RED && states.includes(TrafficLight.GREEN)) return TrafficLight.ORANGE;
  if (states.every((state) => state === TrafficLight.GREEN)) return TrafficLight.GREEN;
  if (states.every((state) => state === TrafficLight.RED)) return TrafficLight.RED;
  return TrafficLight.ORANGE;
}

function latestDirection(windowAssessments) {
  return [...windowAssessments].reverse().find((item) => item.direction !== DirectionState.UNKNOWN)?.direction ?? DirectionState.UNKNOWN;
}

function latestBy(items, key) {
  const result = new Map();
  for (const item of items) result.set(item[key], item);
  return [...result.values()];
}

export function evaluatePremarketIntelligence({
  marketSessionBoundary,
  futuresSnapshots = [],
  marketSnapshots = [],
  premarketStockSnapshots = [],
  sectorSnapshots = [],
  catalystEvents = [],
  globalRotationAssessments = [],
  discoveryCandidates = [],
  evaluatedAt,
  ruleProfile = PREMARKET_INTELLIGENCE_RULE_PROFILE,
}) {
  const forbiddenPayloadFields = ["providerPayload", "vendorPayload", "rawProviderPayload"];
  for (const input of [marketSessionBoundary, ...futuresSnapshots, ...marketSnapshots, ...premarketStockSnapshots, ...sectorSnapshots, ...catalystEvents, ...globalRotationAssessments, ...discoveryCandidates]) {
    for (const field of forbiddenPayloadFields) {
      if (input && Object.hasOwn(input, field)) throw new Error(`Provider payload fields are forbidden in normalized Package 004 input: ${field}`);
    }
  }
  validateContract("MarketSessionBoundary", marketSessionBoundary);
  futuresSnapshots.forEach((item) => validateContract("FuturesSnapshot", item));
  marketSnapshots.forEach((item) => validateContract("MarketSnapshot", item));
  premarketStockSnapshots.forEach((item) => validateContract("PremarketStockSnapshot", item));
  sectorSnapshots.forEach((item) => validateContract("SectorSnapshot", item));
  catalystEvents.forEach((item) => validateContract("CatalystEvent", item));
  globalRotationAssessments.forEach((item) => validateContract("GlobalRotationAssessment", item));
  discoveryCandidates.forEach((item) => validateContract("DiscoveryCandidate", item));

  const requestedEvaluationMs = Date.parse(evaluatedAt);
  if (!Number.isFinite(requestedEvaluationMs)) throw new TypeError("evaluatedAt must be a UTC timestamp");
  const priorCloseMs = Date.parse(marketSessionBoundary.priorRegularCloseTimestamp);
  if (requestedEvaluationMs < priorCloseMs) throw new Error("evaluatedAt precedes the explicit extended-hours session boundary");
  const regularOpenMs = Date.parse(marketSessionBoundary.regularOpenTimestamp);
  const effectiveAt = requestedEvaluationMs >= regularOpenMs ? marketSessionBoundary.regularOpenTimestamp : evaluatedAt;
  const allInputs = [
    ...futuresSnapshots,
    ...marketSnapshots,
    ...premarketStockSnapshots,
    ...sectorSnapshots,
    ...catalystEvents,
    ...globalRotationAssessments,
    ...discoveryCandidates,
  ];
  assertEvaluationTime(effectiveAt, allInputs);
  marketSessionBoundary.evidenceRefs.forEach((item) => assertEvidenceTime({ evidenceRefs: [item] }, effectiveAt));
  allInputs.forEach((item) => assertEvidenceTime(item, effectiveAt));

  const sortedFutures = uniqueByIdentity([...futuresSnapshots].sort((left, right) =>
    lexicalCompare(left.instrument, right.instrument) || lexicalCompare(left.timestamp, right.timestamp) || lexicalCompare(left.snapshotId, right.snapshotId)), "FuturesSnapshot");
  const sortedMarkets = uniqueByIdentity([...marketSnapshots].sort((left, right) =>
    lexicalCompare(left.timestamp, right.timestamp) || lexicalCompare(left.snapshotId, right.snapshotId)), "MarketSnapshot");
  const sortedStocks = uniqueByIdentity([...premarketStockSnapshots].sort((left, right) =>
    lexicalCompare(left.symbol, right.symbol) || lexicalCompare(left.timestamp, right.timestamp) || lexicalCompare(left.snapshotId, right.snapshotId)), "PremarketStockSnapshot");
  const sortedSectors = uniqueByIdentity([...sectorSnapshots].sort((left, right) =>
    lexicalCompare(left.sectorId, right.sectorId) || lexicalCompare(left.timestamp, right.timestamp) || lexicalCompare(left.snapshotId, right.snapshotId)), "SectorSnapshot");
  const sortedCatalysts = uniqueByIdentity([...catalystEvents].sort((left, right) =>
    lexicalCompare(left.timestamp, right.timestamp) || lexicalCompare(left.eventId, right.eventId)), "CatalystEvent");
  const sortedGlobal = uniqueByIdentity([...globalRotationAssessments].sort((left, right) =>
    lexicalCompare(left.countryOrRegion, right.countryOrRegion) || lexicalCompare(left.horizon, right.horizon) || lexicalCompare(left.assessmentId, right.assessmentId)), "GlobalRotationAssessment");
  const sortedDiscovery = uniqueByIdentity([...discoveryCandidates].sort((left, right) =>
    lexicalCompare(left.symbol, right.symbol) || lexicalCompare(left.candidateId, right.candidateId)), "DiscoveryCandidate");

  const buckets = Object.fromEntries(PREMARKET_WINDOW_ORDER.map((window) => [window, { futures: [], markets: [], stocks: [], sectors: [], catalysts: [], global: [] }]));
  for (const input of sortedFutures) buckets[assertSessionIdentity(input, marketSessionBoundary)].futures.push(input);
  for (const input of sortedMarkets) buckets[assertSessionIdentity(input, marketSessionBoundary)].markets.push(input);
  for (const input of sortedStocks) buckets[assertSessionIdentity(input, marketSessionBoundary)].stocks.push(input);
  for (const input of sortedSectors) buckets[assertSessionIdentity(input, marketSessionBoundary)].sectors.push(input);
  for (const event of sortedCatalysts) {
    const window = classifyPremarketWindow(event.timestamp, marketSessionBoundary);
    if (window) buckets[window].catalysts.push(event);
    else if (Date.parse(event.timestamp) >= regularOpenMs) throw new Error(`Post-open evidence is forbidden: ${event.eventId}`);
  }
  for (const assessment of sortedGlobal) {
    const window = classifyPremarketWindow(assessment.timestamp, marketSessionBoundary);
    if (window) buckets[window].global.push(assessment);
    else if (Date.parse(assessment.timestamp) >= regularOpenMs) throw new Error(`Post-open evidence is forbidden: ${assessment.assessmentId}`);
  }
  for (const candidate of sortedDiscovery) {
    if (Date.parse(candidate.timestamp) >= regularOpenMs) throw new Error(`Post-open evidence is forbidden: ${candidate.candidateId}`);
  }

  const engineMeta = createEngineMeta(ruleProfile, effectiveAt, {
    MarketSessionBoundary: marketSessionBoundary.schemaVersion,
    FuturesSnapshot: sortedFutures[0]?.schemaVersion ?? SCHEMA_VERSION,
    MarketSnapshot: sortedMarkets[0]?.schemaVersion ?? SCHEMA_VERSION,
    PremarketStockSnapshot: sortedStocks[0]?.schemaVersion ?? SCHEMA_VERSION,
    SectorSnapshot: sortedSectors[0]?.schemaVersion ?? SCHEMA_VERSION,
    CatalystEvent: sortedCatalysts[0]?.schemaVersion ?? SCHEMA_VERSION,
    GlobalRotationAssessment: sortedGlobal[0]?.schemaVersion ?? SCHEMA_VERSION,
    DiscoveryCandidate: sortedDiscovery[0]?.schemaVersion ?? SCHEMA_VERSION,
    PremarketWindowAssessment: SCHEMA_VERSION,
    PremarketSnapshot: SCHEMA_VERSION,
  });
  const windowAssessments = PREMARKET_WINDOW_ORDER.map((window) => buildWindowAssessment({
    window,
    bucket: buckets[window],
    engineMeta,
    boundary: marketSessionBoundary,
    ruleProfile,
  }));

  const participation = participationAssessment(sortedStocks, ruleProfile);
  const participationState = proxyTrafficLight(participation.state);
  const globalMarketState = globalTrafficLight(sortedGlobal);
  const pendingEvents = sortedCatalysts.filter((event) => event.scheduled &&
    Date.parse(event.scheduledAt) > Date.parse(effectiveAt) &&
    Date.parse(event.scheduledAt) < regularOpenMs &&
    (Date.parse(event.scheduledAt) - Date.parse(effectiveAt)) / 1000 <= ruleProfile.highImpactEventWindowSeconds &&
    [CatalystImpactTier.HIGH, CatalystImpactTier.CRITICAL].includes(event.impactTier));
  const releasedEvents = sortedCatalysts.filter((event) => !event.scheduled || Date.parse(event.timestamp) >= Date.parse(event.scheduledAt));
  const macroRiskState = pendingEvents.some((event) => event.impactTier === CatalystImpactTier.CRITICAL) ? TrafficLight.RED :
    pendingEvents.length ? TrafficLight.ORANGE : releasedEvents.length ? TrafficLight.ORANGE : TrafficLight.GREY;
  const futuresState = futuresTrafficLight(buckets, ruleProfile);
  const compositeState = compositeTrafficLight(windowAssessments, globalMarketState, macroRiskState);
  const directionState = latestDirection(windowAssessments);

  const globalProxyEvidence = sortedGlobal
    .filter((item) => ["overnight", "1d"].includes(item.horizon))
    .flatMap((item) => item.proxyEvidence)
    .filter((item) => sourceEligible(item.sourceMeta))
    .map((item) => asPremarketProxy(item, "global.context", PremarketWindow.PREMARKET));
  const pendingEvidence = pendingEvents.map((event) => catalystEvidence(event, "pending-risk"));
  const windowSupporting = windowAssessments.flatMap((item) => item.supportingEvidence);
  const windowOpposing = windowAssessments.flatMap((item) => item.opposingEvidence);
  const latestWindowState = [...windowAssessments].reverse().find((item) => item.state !== TrafficLight.GREY)?.state ?? TrafficLight.GREY;
  const unitedStatesState = futuresState !== TrafficLight.GREY ? futuresState : latestWindowState;
  const globalDisagrees = (unitedStatesState === TrafficLight.GREEN && globalMarketState === TrafficLight.RED) ||
    (unitedStatesState === TrafficLight.RED && globalMarketState === TrafficLight.GREEN);
  const supportingEvidence = uniqueEvidence([
    ...windowSupporting,
    ...participation.evidence,
    ...(!globalDisagrees ? globalProxyEvidence : []),
  ]);
  const opposingEvidence = uniqueEvidence([
    ...windowOpposing,
    ...pendingEvidence,
    ...(globalDisagrees ? globalProxyEvidence : []),
  ]);
  const freshnessInputs = [marketSessionBoundary, ...sortedFutures, ...sortedMarkets, ...sortedStocks, ...sortedSectors, ...sortedCatalysts, ...sortedGlobal, ...sortedDiscovery];
  const freshness = freshnessFromInputs(freshnessInputs, effectiveAt, "Package 004 normalized input freshness");
  const windowStates = windowAssessments.map((item) => item.state).filter((state) => state !== TrafficLight.GREY);
  const stateConflict = windowStates.includes(TrafficLight.GREEN) && windowStates.includes(TrafficLight.RED);
  const degradation = [
    ...participation.degradedBy,
    ...(pendingEvents.length ? [`${pendingEvents.length} pending HIGH/CRITICAL event(s) before regular open.`] : []),
    ...(globalDisagrees ? ["United States premarket and short-horizon global context disagree."] : []),
    ...(sortedGlobal.some((item) => !["overnight", "1d"].includes(item.horizon)) ? ["Long-horizon global context was not relabeled as overnight flow."] : []),
    ...(sortedDiscovery.length ? ["AI Discovered remained separate; no My Focus promotion occurred."] : []),
  ];
  let snapshotConfidence = confidence({
    coverage: windowStates.length / PREMARKET_WINDOW_ORDER.length,
    conflicts: stateConflict || globalDisagrees ? 1 : 0,
    freshness,
    reasons: [`${windowStates.length} independently retained extended-hours window state(s) contributed to the SHADOW snapshot.`],
    degradedBy: degradation,
  });
  if (pendingEvents.length) snapshotConfidence = cappedConfidence(snapshotConfidence, Math.max(0, snapshotConfidence.score - ruleProfile.pendingEventConfidencePenalty), ["Pending scheduled-event confidence penalty applied."]);
  if (sortedStocks.some((item) => item.liquidityQuality === LiquidityQuality.LOW)) snapshotConfidence = cappedConfidence(snapshotConfidence, 0.69, ["LOW liquidity prevents high confidence."]);
  if (sortedStocks.some((item) => item.liquidityQuality === LiquidityQuality.INSUFFICIENT)) snapshotConfidence = cappedConfidence(snapshotConfidence, 0.49, ["INSUFFICIENT liquidity prevents high confidence."]);

  const latestSectors = latestBy(sortedSectors, "sectorId").sort((left, right) => lexicalCompare(left.sectorId, right.sectorId));
  const discoveredSymbols = new Set(sortedDiscovery.map((item) => item.symbol));
  const latestStocks = latestBy(sortedStocks, "symbol").sort((left, right) => lexicalCompare(left.symbol, right.symbol));
  const discoveredStocks = latestStocks.filter((item) => discoveredSymbols.has(item.symbol));
  const freezeStatus = requestedEvaluationMs >= regularOpenMs ? PremarketFreezeStatus.FROZEN : PremarketFreezeStatus.LIVE;
  const currentWindow = classifyPremarketWindow(effectiveAt, marketSessionBoundary);
  const sessionPhase = currentWindow ? windowToPhase[currentWindow] : SessionPhase.PREMARKET;
  const sourceSnapshotIds = uniqueStrings([
    ...sortedFutures,
    ...sortedMarkets,
    ...sortedStocks,
    ...sortedSectors,
    ...sortedGlobal,
    ...sortedDiscovery,
  ].map(inputId));

  const output = deepFreeze({
    schemaVersion: SCHEMA_VERSION,
    snapshotId: premarketSnapshotId({
      engineVersion: engineMeta.engineVersion,
      ruleProfileId: engineMeta.ruleProfileId,
      evaluatedAt: effectiveAt,
      sessionDate: marketSessionBoundary.sessionDate,
      sessionCalendarId: marketSessionBoundary.sessionCalendarId,
    }),
    timestamp: effectiveAt,
    sessionDate: marketSessionBoundary.sessionDate,
    futuresState,
    macroRiskState,
    globalMarketState,
    participationState,
    sectorStates: latestSectors.map((item) => `${item.sectorId}:${item.state}`),
    focusStocks: [],
    discoveredStocks,
    scheduledEventIds: uniqueStrings(pendingEvents.map((event) => event.eventId)),
    newsEventIds: [],
    compositeState,
    directionState,
    confidence: snapshotConfidence,
    freshness,
    evidenceRefs: uniqueEvidence([...supportingEvidence, ...opposingEvidence]),
    sessionIdentity: deepFreeze({
      sessionDate: marketSessionBoundary.sessionDate,
      sessionPhase,
      sessionCalendarId: marketSessionBoundary.sessionCalendarId,
    }),
    windowAssessments,
    supportingEvidence,
    opposingEvidence,
    sourceSnapshotIds,
    regularOpenTimestamp: marketSessionBoundary.regularOpenTimestamp,
    freezeStatus,
    frozenAt: freezeStatus === PremarketFreezeStatus.FROZEN ? marketSessionBoundary.regularOpenTimestamp : null,
    engineMeta,
  });
  validateContract("PremarketSnapshot", output);
  return output;
}
