import { canonicalize } from "../contracts/serialization.js";
import {
  compareDirectionAssessments,
  lexicalCompare,
  STOCK_DECISION_ENGINE_ID,
  STOCK_DECISION_ENGINE_VERSION,
  STOCK_DECISION_RULE_PROFILE_ID,
  STOCK_DECISION_RULE_PROFILE_VERSION,
  stockDecisionId,
} from "../contracts/stock-decision-intelligence.js";
import { validateContract } from "../contracts/validators.js";
import {
  CatalystImpactTier,
  DirectionState,
  EvidenceType,
  FeatureLifecycle,
  FlowState,
  FreshnessStatus,
  SCHEMA_VERSION,
  StockAnalysisOrigin,
  StockDecisionState,
  TrafficLight,
} from "../domain/constants.js";
import {
  assertEvaluationTime,
  clamp,
  confidence,
  createEngineMeta,
  deepFreeze,
  freshnessFromInputs,
  measurementValue,
  round,
} from "./engine-utils.js";
import { STOCK_DECISION_RULE_PROFILE } from "./rules/profiles.js";

const ALLOWED_ARGUMENTS = new Set([
  "subjects", "stockSnapshots", "marketDecisionState", "directionAssessments",
  "sectorSnapshots", "flowAssessments", "catalystEvents", "discoveryCandidates",
  "evaluatedAt", "ruleProfile",
]);

const TRAFFIC_BY_STATE = Object.freeze({
  [StockDecisionState.ACCUMULATION]: TrafficLight.GREEN,
  [StockDecisionState.BUY_PRESSURE]: TrafficLight.GREEN,
  [StockDecisionState.NEUTRAL]: TrafficLight.ORANGE,
  [StockDecisionState.CONFLICTED]: TrafficLight.ORANGE,
  [StockDecisionState.DISTRIBUTION]: TrafficLight.RED,
  [StockDecisionState.SELL_PRESSURE]: TrafficLight.RED,
  [StockDecisionState.WAIT_EVENT_RISK]: TrafficLight.ORANGE,
  [StockDecisionState.UNKNOWN]: TrafficLight.GREY,
});

function validateProfile(ruleProfile) {
  const expected = {
    engineId: STOCK_DECISION_ENGINE_ID,
    engineVersion: STOCK_DECISION_ENGINE_VERSION,
    ruleProfileId: STOCK_DECISION_RULE_PROFILE_ID,
    version: STOCK_DECISION_RULE_PROFILE_VERSION,
    status: "EXPERIMENTAL",
    lifecycle: FeatureLifecycle.SHADOW,
  };
  for (const [field, value] of Object.entries(expected)) {
    if (ruleProfile?.[field] !== value) throw new Error(`Package 006 rule profile ${field} must equal ${value}`);
  }
  return ruleProfile;
}

function uniqueByIdentity(items, identityField, label) {
  const result = [];
  const seen = new Map();
  for (const item of items) {
    const identity = item[identityField];
    const bytes = canonicalize(item);
    if (seen.has(identity)) {
      if (seen.get(identity) !== bytes) throw new Error(`Conflicting duplicate ${label} identity: ${identity}`);
      continue;
    }
    seen.set(identity, bytes);
    result.push(item);
  }
  return result;
}

function uniqueEvidence(items) {
  return uniqueByIdentity(items.filter(Boolean), "evidenceId", "EvidenceRef")
    .sort((left, right) => lexicalCompare(left.evidenceId, right.evidenceId));
}

const uniqueStrings = (values) => [...new Set(values.filter((item) => typeof item === "string" && item.length > 0))].sort(lexicalCompare);

function allEvidence(input) {
  return [
    ...(input?.evidenceRefs ?? []),
    ...(input?.supportingEvidence ?? []),
    ...(input?.opposingEvidence ?? []),
    ...(input?.directEvidence ?? []),
    ...(input?.proxyEvidence ?? []),
  ];
}

function assertStrictTime(evaluatedAt, inputs) {
  assertEvaluationTime(evaluatedAt, inputs);
  const maximum = Date.parse(evaluatedAt);
  for (const input of inputs.filter(Boolean)) {
    for (const evidence of allEvidence(input)) {
      const source = evidence.sourceMeta;
      if (source?.observedAt !== null && Date.parse(source?.observedAt) > maximum) throw new Error(`Future source observation is forbidden: ${source.sourceId}`);
      if (source?.receivedAt !== null && Date.parse(source?.receivedAt) > maximum) throw new Error(`Future source receipt is forbidden: ${source.sourceId}`);
    }
  }
}

function sourceEligible(source, evaluatedAt) {
  const maximum = Date.parse(evaluatedAt);
  return source && !source.isStale && source.observedAt !== null && source.receivedAt !== null &&
    Date.parse(source.observedAt) <= maximum && Date.parse(source.receivedAt) <= maximum;
}

function evidenceFor(snapshot, field, evaluatedAt) {
  return uniqueEvidence((snapshot?.evidenceRefs ?? []).filter((evidence) =>
    (evidence.field === field || evidence.field === `${field}.value`) && sourceEligible(evidence.sourceMeta, evaluatedAt)));
}

function measurementFamily(snapshot, field, evaluatedAt) {
  const value = measurementValue(snapshot?.[field]);
  const evidence = evidenceFor(snapshot, field, evaluatedAt);
  return Number.isFinite(value) && evidence.length > 0 ? { field, value, evidence } : null;
}

function sameSession(left, right) {
  return left?.sessionIdentity && right?.sessionIdentity &&
    left.sessionIdentity.sessionDate === right.sessionIdentity.sessionDate &&
    left.sessionIdentity.sessionPhase === right.sessionIdentity.sessionPhase &&
    left.sessionIdentity.sessionCalendarId === right.sessionIdentity.sessionCalendarId;
}

function validateHistory(snapshots) {
  if (snapshots.length < 2) return;
  const current = snapshots.at(-1);
  if (!current.sessionIdentity) throw new Error(`Historical StockSnapshot comparison requires SessionIdentity: ${current.snapshotId}`);
  for (const reference of snapshots.slice(0, -1)) {
    if (Date.parse(reference.timestamp) >= Date.parse(current.timestamp)) throw new Error(`Historical StockSnapshot must be strictly earlier than current: ${reference.snapshotId}`);
    if (!sameSession(reference, current)) throw new Error(`Cross-session or missing-identity StockSnapshot comparison rejected: ${reference.snapshotId}`);
  }
}

function contextEvidence(input, positive, evaluatedAt) {
  if (!input?.freshness?.decisionGrade) return { positive: [], negative: [], degraded: input ? [input] : [] };
  const supporting = uniqueEvidence((input.supportingEvidence ?? []).filter((item) => sourceEligible(item.sourceMeta, evaluatedAt)));
  const opposing = uniqueEvidence((input.opposingEvidence ?? []).filter((item) => sourceEligible(item.sourceMeta, evaluatedAt)));
  return positive ? { positive: supporting, negative: opposing, degraded: [] } : { positive: opposing, negative: supporting, degraded: [] };
}

function flowContext(flow, evaluatedAt) {
  if (!flow.freshness?.decisionGrade) return { sign: 0, evidence: [], degraded: true };
  const evidence = uniqueEvidence([
    ...flow.directEvidence.filter((item) => sourceEligible(item.sourceMeta, evaluatedAt)),
    ...flow.proxyEvidence.filter((item) => sourceEligible(item.sourceMeta, evaluatedAt)),
  ]);
  const sign = flow.state === FlowState.DEMAND ? 1 : flow.state === FlowState.SELLING_PRESSURE ? -1 : 0;
  return { sign, evidence, degraded: false };
}

function pendingEventEvidence(event) {
  return deepFreeze({
    schemaVersion: SCHEMA_VERSION,
    evidenceId: `stock-event-risk:${event.eventId}`,
    sourceMeta: event.sourceMeta,
    field: `catalystEvent.${event.eventId}.scheduledAt`,
    value: event.scheduledAt ?? event.timestamp,
    unit: null,
    evidenceType: EvidenceType.DERIVED,
  });
}

function eligibleRiskEvents(events, symbol, evaluatedAt, ruleProfile) {
  const evaluatedMs = Date.parse(evaluatedAt);
  return events.filter((event) => {
    if (!event.affectedSymbols.includes(symbol) || ![CatalystImpactTier.HIGH, CatalystImpactTier.CRITICAL].includes(event.impactTier)) return false;
    if (!sourceEligible(event.sourceMeta, evaluatedAt)) return false;
    const eventTime = event.scheduled ? Date.parse(event.scheduledAt) : Date.parse(event.timestamp);
    return Math.abs(eventTime - evaluatedMs) / 1000 <= ruleProfile.pendingHighImpactEventWindowSeconds;
  });
}

function buildDecision({ subject, snapshots, marketDecisionState, directions, sectors, flows, catalysts, evaluatedAt, engineMeta, ruleProfile }) {
  const current = snapshots.at(-1) ?? null;
  const history = snapshots.slice(0, -1);
  const stockFreshness = current ? freshnessFromInputs([current], evaluatedAt, "Package 006 stock evidence freshness") : deepFreeze({
    schemaVersion: SCHEMA_VERSION,
    status: FreshnessStatus.UNAVAILABLE,
    assessedAt: evaluatedAt,
    ageSeconds: null,
    reason: "Package 006 stock evidence freshness: UNAVAILABLE.",
    decisionGrade: false,
  });
  const degradedBy = [];
  const sourceSnapshotIds = uniqueStrings([...(current ? [current.snapshotId] : []), ...history.map((item) => item.snapshotId)]);
  const sector = current?.sectorId ? sectors.filter((item) => item.sectorId === current.sectorId).at(-1) ?? null : null;
  if (sector) sourceSnapshotIds.push(...uniqueStrings([sector.snapshotId]));
  const directionAssessmentIds = directions.map((item) => item.assessmentId);
  const relevantCatalysts = catalysts.filter((event) => event.affectedSymbols.includes(subject.symbol));
  const eventRisks = eligibleRiskEvents(relevantCatalysts, subject.symbol, evaluatedAt, ruleProfile);

  const families = current ? {
    price: measurementFamily(current, "changePct", evaluatedAt),
    participation: measurementFamily(current, "relativeVolume", evaluatedAt),
    vwap: measurementFamily(current, "distanceFromVWAPPct", evaluatedAt),
    relativeStrength: measurementFamily(current, "relativeStrengthVsBenchmark", evaluatedAt),
  } : {};
  const criticalValid = current && stockFreshness.decisionGrade && Object.values(families).every(Boolean);
  const positive = [];
  const negative = [];
  const neutralEvidence = [];
  if (criticalValid) {
    const priceSign = Math.sign(families.price.value);
    if (priceSign > 0) positive.push(...families.price.evidence);
    else if (priceSign < 0) negative.push(...families.price.evidence);
    else neutralEvidence.push(...families.price.evidence);

    if (families.participation.value >= ruleProfile.relativeVolumeParticipationThreshold) {
      if (priceSign > 0) positive.push(...families.participation.evidence);
      else if (priceSign < 0) negative.push(...families.participation.evidence);
      else neutralEvidence.push(...families.participation.evidence);
    } else neutralEvidence.push(...families.participation.evidence);

    if (families.vwap.value >= ruleProfile.vwapDistanceThreshold) positive.push(...families.vwap.evidence);
    else if (families.vwap.value <= -ruleProfile.vwapDistanceThreshold) negative.push(...families.vwap.evidence);
    else neutralEvidence.push(...families.vwap.evidence);

    if (families.relativeStrength.value >= ruleProfile.relativeStrengthThreshold) positive.push(...families.relativeStrength.evidence);
    else if (families.relativeStrength.value <= -ruleProfile.relativeStrengthThreshold) negative.push(...families.relativeStrength.evidence);
    else neutralEvidence.push(...families.relativeStrength.evidence);
  } else {
    degradedBy.push(current ? "Critical stock evidence is missing, stale, unavailable, or lacks eligible provenance." : "No StockSnapshot was supplied for the selected subject.");
  }

  const familySign = new Map();
  if (criticalValid) {
    familySign.set("price", Math.sign(families.price.value));
    familySign.set("participation", families.participation.value >= ruleProfile.relativeVolumeParticipationThreshold ? Math.sign(families.price.value) : 0);
    familySign.set("vwap", families.vwap.value >= ruleProfile.vwapDistanceThreshold ? 1 : families.vwap.value <= -ruleProfile.vwapDistanceThreshold ? -1 : 0);
    familySign.set("relativeStrength", families.relativeStrength.value >= ruleProfile.relativeStrengthThreshold ? 1 : families.relativeStrength.value <= -ruleProfile.relativeStrengthThreshold ? -1 : 0);
  }
  const positiveFamilies = [...familySign.values()].filter((value) => value > 0).length;
  const negativeFamilies = [...familySign.values()].filter((value) => value < 0).length;

  const contextPositive = [];
  const contextNegative = [];
  const marketPositive = marketDecisionState.state === "RISK_ON" || marketDecisionState.trafficLight === TrafficLight.GREEN;
  const marketNegative = marketDecisionState.state === "RISK_OFF" || marketDecisionState.trafficLight === TrafficLight.RED;
  if (marketPositive || marketNegative) {
    const evidence = contextEvidence(marketDecisionState, marketPositive, evaluatedAt);
    contextPositive.push(...evidence.positive);
    contextNegative.push(...evidence.negative);
    if (evidence.degraded.length) degradedBy.push("Market context is not decision-grade and was excluded.");
  }
  for (const direction of directions) {
    if (!direction.freshness.decisionGrade) {
      degradedBy.push(`Direction context ${direction.assessmentId} is not decision-grade and was excluded.`);
      continue;
    }
    const evidence = contextEvidence(direction, direction.direction === DirectionState.IMPROVING, evaluatedAt);
    if (direction.direction === DirectionState.IMPROVING) contextPositive.push(...evidence.positive);
    else if (direction.direction === DirectionState.DETERIORATING) contextNegative.push(...evidence.negative);
  }
  if (sector) {
    const eligibleSectorEvidence = sector.evidenceRefs.filter((item) => sourceEligible(item.sourceMeta, evaluatedAt));
    if (!sector.confidence || sector.state === TrafficLight.GREY || eligibleSectorEvidence.length === 0) degradedBy.push("Sector context is stale, unavailable, or non-directional and was excluded.");
    else if (sector.state === TrafficLight.GREEN) contextPositive.push(...eligibleSectorEvidence);
    else if (sector.state === TrafficLight.RED) contextNegative.push(...eligibleSectorEvidence);
  } else degradedBy.push("Matching sector context is missing; missing is not neutral.");
  for (const flow of flows) {
    const context = flowContext(flow, evaluatedAt);
    if (context.degraded) degradedBy.push(`Flow context ${flow.assessmentId} is not decision-grade and was excluded.`);
    else if (context.sign > 0) contextPositive.push(...context.evidence);
    else if (context.sign < 0) contextNegative.push(...context.evidence);
  }

  let state = StockDecisionState.UNKNOWN;
  let supportingEvidence = uniqueEvidence([...positive, ...negative, ...neutralEvidence]);
  let opposingEvidence = [];
  if (eventRisks.length > 0) {
    state = StockDecisionState.WAIT_EVENT_RISK;
    supportingEvidence = uniqueEvidence(eventRisks.map(pendingEventEvidence));
    opposingEvidence = uniqueEvidence([...positive, ...negative, ...contextPositive, ...contextNegative]);
    degradedBy.push("Relevant HIGH/CRITICAL event risk is pending or temporally active; directional classification is suspended.");
  } else if (criticalValid) {
    const positiveIntent = positiveFamilies >= ruleProfile.minimumEvidenceFamilies && negativeFamilies === 0;
    const negativeIntent = negativeFamilies >= ruleProfile.minimumEvidenceFamilies && positiveFamilies === 0;
    const positiveConflict = positiveIntent && contextNegative.length > 0;
    const negativeConflict = negativeIntent && contextPositive.length > 0;
    if ((positiveFamilies > 0 && negativeFamilies > 0) || positiveConflict || negativeConflict) {
      state = StockDecisionState.CONFLICTED;
      if (positiveFamilies >= negativeFamilies) {
        supportingEvidence = uniqueEvidence([...positive, ...contextPositive]);
        opposingEvidence = uniqueEvidence([...negative, ...contextNegative]);
      } else {
        supportingEvidence = uniqueEvidence([...negative, ...contextNegative]);
        opposingEvidence = uniqueEvidence([...positive, ...contextPositive]);
      }
    } else if (positiveIntent) {
      state = positiveFamilies === 4 && contextPositive.length > 0 ? StockDecisionState.ACCUMULATION : StockDecisionState.BUY_PRESSURE;
      supportingEvidence = uniqueEvidence([...positive, ...contextPositive]);
      opposingEvidence = uniqueEvidence(contextNegative);
    } else if (negativeIntent) {
      state = negativeFamilies === 4 && contextNegative.length > 0 ? StockDecisionState.DISTRIBUTION : StockDecisionState.SELL_PRESSURE;
      supportingEvidence = uniqueEvidence([...negative, ...contextNegative]);
      opposingEvidence = uniqueEvidence(contextPositive);
    } else {
      state = StockDecisionState.NEUTRAL;
      supportingEvidence = uniqueEvidence([...positive, ...negative, ...neutralEvidence, ...contextPositive, ...contextNegative]);
      opposingEvidence = [];
    }
  }

  const conflicts = opposingEvidence.length > 0 ? 1 : 0;
  const baseConfidence = confidence({
    coverage: criticalValid ? 1 : 0,
    conflicts,
    freshness: stockFreshness,
    reasons: [`Package 006 classified ${subject.symbol} from ${criticalValid ? 4 : 0} eligible stock evidence families.`],
    degradedBy,
  });
  let confidenceScore = baseConfidence.score;
  if (opposingEvidence.length && contextNegative.length) confidenceScore -= ruleProfile.marketConflictPenalty;
  if (sector?.state === TrafficLight.RED && positiveFamilies >= ruleProfile.minimumEvidenceFamilies) confidenceScore -= ruleProfile.sectorConflictPenalty;
  if (eventRisks.length) confidenceScore = Math.min(confidenceScore, ruleProfile.eventRiskConfidenceCap);
  if (!stockFreshness.decisionGrade) confidenceScore = Math.min(confidenceScore, ruleProfile.lowFreshnessPenalty);
  const decisionConfidence = deepFreeze({ ...baseConfidence, score: round(clamp(confidenceScore, 0, 1)) });
  const score = state === StockDecisionState.UNKNOWN ? null : state === StockDecisionState.WAIT_EVENT_RISK ? 0 :
    round(clamp((positiveFamilies - negativeFamilies) / 4));
  const context = deepFreeze({
    subjectId: subject.subjectId,
    symbol: subject.symbol,
    origin: subject.origin,
    marketDecisionId: marketDecisionState.decisionId,
    directionAssessmentIds,
    sectorId: sector?.sectorId ?? null,
    catalystEventIds: uniqueStrings(relevantCatalysts.map((item) => item.eventId)),
    sourceSnapshotIds: uniqueStrings(sourceSnapshotIds),
    engineMeta,
  });
  const decision = deepFreeze({
    schemaVersion: SCHEMA_VERSION,
    decisionId: stockDecisionId({ engineVersion: engineMeta.engineVersion, ruleProfileId: engineMeta.ruleProfileId, evaluatedAt, subjectId: subject.subjectId, symbol: subject.symbol }),
    timestamp: evaluatedAt,
    scope: "STOCK",
    scopeId: subject.symbol,
    state,
    trafficLight: TRAFFIC_BY_STATE[state],
    score,
    confidence: decisionConfidence,
    supportingEvidence,
    opposingEvidence,
    freshness: stockFreshness,
    engineVersion: engineMeta.engineVersion,
    engineMeta,
    stockDecisionContext: context,
  });
  validateContract("DecisionState", decision);
  return decision;
}

export function evaluateStockDecisions(input) {
  for (const key of Object.keys(input ?? {})) if (!ALLOWED_ARGUMENTS.has(key)) throw new Error(`Unauthorized Package 006 input: ${key}`);
  const {
    subjects = [], stockSnapshots = [], marketDecisionState, directionAssessments = [],
    sectorSnapshots = [], flowAssessments = [], catalystEvents = [], discoveryCandidates = [],
    evaluatedAt, ruleProfile = STOCK_DECISION_RULE_PROFILE,
  } = input ?? {};
  validateProfile(ruleProfile);
  subjects.forEach((item) => validateContract("StockAnalysisSubject", item));
  stockSnapshots.forEach((item) => validateContract("StockSnapshot", item));
  validateContract("DecisionState", marketDecisionState);
  if (marketDecisionState.scope !== "MARKET") throw new Error("Package 006 requires one approved MARKET DecisionState");
  directionAssessments.forEach((item) => validateContract("DirectionAssessment", item));
  if (directionAssessments.some((item) => item.scope !== "MARKET")) throw new Error("Package 006 accepts MARKET DirectionAssessment context only");
  sectorSnapshots.forEach((item) => validateContract("SectorSnapshot", item));
  flowAssessments.forEach((item) => validateContract("FlowAssessment", item));
  catalystEvents.forEach((item) => validateContract("CatalystEvent", item));
  discoveryCandidates.forEach((item) => validateContract("DiscoveryCandidate", item));

  const allInputs = [marketDecisionState, ...stockSnapshots, ...directionAssessments, ...sectorSnapshots, ...flowAssessments, ...catalystEvents, ...discoveryCandidates];
  assertStrictTime(evaluatedAt, allInputs);
  const evaluatedMs = Date.parse(evaluatedAt);

  const canonicalSubjects = uniqueByIdentity([...subjects].sort((left, right) => lexicalCompare(left.symbol, right.symbol) ||
    Object.values(StockAnalysisOrigin).indexOf(left.origin) - Object.values(StockAnalysisOrigin).indexOf(right.origin) || lexicalCompare(left.subjectId, right.subjectId)), "subjectId", "StockAnalysisSubject");
  const snapshots = uniqueByIdentity([...stockSnapshots].sort((left, right) => lexicalCompare(left.symbol, right.symbol) || lexicalCompare(left.timestamp, right.timestamp) || lexicalCompare(left.snapshotId, right.snapshotId)), "snapshotId", "StockSnapshot");
  const directions = uniqueByIdentity([...directionAssessments].sort(compareDirectionAssessments), "assessmentId", "DirectionAssessment");
  const sectors = uniqueByIdentity([...sectorSnapshots].sort((left, right) => lexicalCompare(left.sectorId, right.sectorId) || lexicalCompare(left.timestamp, right.timestamp) || lexicalCompare(left.snapshotId, right.snapshotId)), "snapshotId", "SectorSnapshot");
  const flows = uniqueByIdentity([...flowAssessments].sort((left, right) => lexicalCompare(left.scope, right.scope) || lexicalCompare(left.scopeId, right.scopeId) || lexicalCompare(left.flowMode, right.flowMode) || lexicalCompare(left.assessmentId, right.assessmentId)), "assessmentId", "FlowAssessment");
  const catalysts = uniqueByIdentity([...catalystEvents].sort((left, right) => lexicalCompare(left.timestamp, right.timestamp) || lexicalCompare(left.eventId, right.eventId)), "eventId", "CatalystEvent");
  const candidates = uniqueByIdentity([...discoveryCandidates].sort((left, right) => lexicalCompare(left.symbol, right.symbol) || lexicalCompare(left.candidateId, right.candidateId)), "candidateId", "DiscoveryCandidate");

  for (const subject of canonicalSubjects) {
    if (Date.parse(subject.selectedAt) > evaluatedMs) throw new Error(`Future StockAnalysisSubject selection is forbidden: ${subject.subjectId}`);
    if (subject.origin === StockAnalysisOrigin.AI_DISCOVERED_SELECTED) {
      const candidate = candidates.find((item) => item.candidateId === subject.discoveryCandidateId);
      if (!candidate) throw new Error(`Selected DiscoveryCandidate is missing: ${subject.discoveryCandidateId}`);
      if (candidate.symbol !== subject.symbol) throw new Error(`DiscoveryCandidate symbol mismatch for subject: ${subject.subjectId}`);
    }
  }

  const bySymbol = new Map();
  for (const snapshot of snapshots) {
    if (!bySymbol.has(snapshot.symbol)) bySymbol.set(snapshot.symbol, []);
    bySymbol.get(snapshot.symbol).push(snapshot);
  }
  for (const series of bySymbol.values()) validateHistory(series);

  const engineMeta = createEngineMeta(ruleProfile, evaluatedAt, {
    StockAnalysisSubject: canonicalSubjects[0]?.schemaVersion ?? SCHEMA_VERSION,
    StockSnapshot: snapshots[0]?.schemaVersion ?? SCHEMA_VERSION,
    DecisionState: marketDecisionState.schemaVersion,
    DirectionAssessment: directions[0]?.schemaVersion ?? SCHEMA_VERSION,
    SectorSnapshot: sectors[0]?.schemaVersion ?? SCHEMA_VERSION,
    FlowAssessment: flows[0]?.schemaVersion ?? SCHEMA_VERSION,
    CatalystEvent: catalysts[0]?.schemaVersion ?? SCHEMA_VERSION,
    DiscoveryCandidate: candidates[0]?.schemaVersion ?? SCHEMA_VERSION,
    StockDecisionContext: SCHEMA_VERSION,
  });
  const decisions = canonicalSubjects.map((subject) => buildDecision({
    subject,
    snapshots: bySymbol.get(subject.symbol) ?? [],
    marketDecisionState,
    directions,
    sectors,
    flows,
    catalysts,
    evaluatedAt,
    engineMeta,
    ruleProfile,
  }));
  return deepFreeze({ engineMeta, decisions });
}
