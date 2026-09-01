import { AssessmentHorizon, DirectionState, SCHEMA_VERSION } from "../domain/constants.js";
import { validateContract } from "../contracts/validators.js";
import {
  assertEvaluationTime,
  clamp,
  confidence,
  createEngineMeta,
  deepFreeze,
  freshnessFromInputs,
  measurementValue,
  round,
  stateTrafficLight,
} from "./engine-utils.js";
import { MARKET_DIRECTION_RULE_PROFILE } from "./rules/profiles.js";
import { HistoricalWindowResult } from "../state/historical-snapshot-window.js";

const average = (values) => values.length ? values.reduce((sum, item) => sum + item, 0) / values.length : null;
const safeRatio = (left, right) => Number.isFinite(left) && Number.isFinite(right) && right !== 0 ? left / right : null;

function marketDelta(current, previous) {
  const deltas = ["spy", "qqq", "iwm", "dia"].map((field) => {
    const now = measurementValue(current[field]);
    const then = measurementValue(previous[field]);
    return now !== null && then !== null && then !== 0 ? ((now / then) - 1) * 100 : null;
  }).filter(Number.isFinite);
  return deltas.length === 4 ? clamp(average(deltas) / 0.6) : null;
}

function breadthSignals(current, previous) {
  const currentAd = safeRatio(measurementValue(current.advancers), measurementValue(current.decliners));
  const priorAd = safeRatio(measurementValue(previous.advancers), measurementValue(previous.decliners));
  const currentVolume = safeRatio(measurementValue(current.advancingVolume), measurementValue(current.decliningVolume));
  const priorVolume = safeRatio(measurementValue(previous.advancingVolume), measurementValue(previous.decliningVolume));
  const currentHighLow = safeRatio(measurementValue(current.newHighs) - measurementValue(current.newLows), measurementValue(current.newHighs) + measurementValue(current.newLows));
  const priorHighLow = safeRatio(measurementValue(previous.newHighs) - measurementValue(previous.newLows), measurementValue(previous.newHighs) + measurementValue(previous.newLows));
  return [
    currentAd !== null && priorAd !== null ? clamp((currentAd - priorAd) / 0.35) : null,
    currentVolume !== null && priorVolume !== null ? clamp((currentVolume - priorVolume) / 0.35) : null,
    currentHighLow !== null && priorHighLow !== null ? clamp((currentHighLow - priorHighLow) / 0.3) : null,
  ];
}

function sectorSignal(currentSectors, previousSectors) {
  const previousById = new Map(previousSectors.map((item) => [item.sectorId, item]));
  const values = currentSectors.map((current) => {
    const previous = previousById.get(current.sectorId);
    if (!previous) return null;
    const priceDelta = measurementValue(current.priceChangePct) - measurementValue(previous.priceChangePct);
    const breadthDelta = measurementValue(current.breadthPctPositive) - measurementValue(previous.breadthPctPositive);
    if (!Number.isFinite(priceDelta) || !Number.isFinite(breadthDelta)) return null;
    return clamp(((priceDelta / 0.8) + (breadthDelta / 15)) / 2);
  }).filter(Number.isFinite);
  return values.length ? average(values) : null;
}

export function evaluateMarketDirection({ marketSnapshot, breadthSnapshot, sectorSnapshots = [], historicalWindow, evaluatedAt, sessionStartTimestamp, ruleProfile = MARKET_DIRECTION_RULE_PROFILE }) {
  validateContract("MarketSnapshot", marketSnapshot);
  validateContract("BreadthSnapshot", breadthSnapshot);
  sectorSnapshots.forEach((item) => validateContract("SectorSnapshot", item));
  assertEvaluationTime(evaluatedAt, [marketSnapshot, breadthSnapshot, ...sectorSnapshots]);
  const freshness = freshnessFromInputs([marketSnapshot, breadthSnapshot, ...sectorSnapshots], evaluatedAt, "Market-direction input freshness");
  const engineMeta = createEngineMeta(ruleProfile, evaluatedAt, { MarketSnapshot: marketSnapshot.schemaVersion, BreadthSnapshot: breadthSnapshot.schemaVersion, SectorSnapshot: sectorSnapshots[0]?.schemaVersion ?? SCHEMA_VERSION });

  const outputs = Object.entries(ruleProfile.horizons).map(([horizon, minutes]) => {
    const options = horizon === AssessmentHorizon.SESSION ? { sessionStartTimestamp, toleranceSeconds: ruleProfile.comparisonToleranceSeconds } : { minutes, toleranceSeconds: ruleProfile.comparisonToleranceSeconds };
    const marketPast = historicalWindow.comparisonFor("MarketSnapshot", "US_MARKET", marketSnapshot, options);
    const breadthPast = historicalWindow.comparisonFor("BreadthSnapshot", breadthSnapshot.venue, breadthSnapshot, options);
    const sectorPasts = sectorSnapshots.map((current) => ({ current, result: historicalWindow.comparisonFor("SectorSnapshot", current.sectorId, current, options) }));
    const criticalHistoryFound = marketPast.status === HistoricalWindowResult.FOUND && breadthPast.status === HistoricalWindowResult.FOUND;
    const signals = criticalHistoryFound ? [marketDelta(marketSnapshot, marketPast.snapshot), ...breadthSignals(breadthSnapshot, breadthPast.snapshot)] : [];
    const priorSectors = sectorPasts.filter((item) => item.result.status === HistoricalWindowResult.FOUND).map((item) => item.result.snapshot);
    if (criticalHistoryFound) signals.push(sectorSignal(sectorSnapshots, priorSectors));
    const available = signals.filter(Number.isFinite);
    const score = available.length ? round(average(available)) : null;
    let direction = DirectionState.STABLE;
    if (!freshness.decisionGrade || !criticalHistoryFound || available.length < ruleProfile.minimumComparableFamilies) direction = DirectionState.UNKNOWN;
    else if (score >= ruleProfile.improvingThreshold) direction = DirectionState.IMPROVING;
    else if (score <= ruleProfile.deterioratingThreshold) direction = DirectionState.DETERIORATING;
    const currentEvidence = [marketSnapshot, breadthSnapshot, ...sectorSnapshots].flatMap((item) => item.evidenceRefs);
    const previousEvidence = [marketPast.snapshot, breadthPast.snapshot, ...priorSectors].filter(Boolean).flatMap((item) => item.evidenceRefs);
    const output = deepFreeze({
      schemaVersion: SCHEMA_VERSION,
      assessmentId: `market-direction:${horizon}:${marketSnapshot.snapshotId}:${evaluatedAt}`,
      timestamp: evaluatedAt,
      scope: "MARKET",
      scopeId: "US_MARKET",
      horizon,
      direction,
      score: direction === DirectionState.UNKNOWN ? null : score,
      trafficLight: stateTrafficLight(direction),
      confidence: confidence({
        coverage: available.length / 5,
        freshness,
        reasons: [`${available.length} past-only comparison families evaluated independently for ${horizon}.`],
        degradedBy: criticalHistoryFound ? [] : ["Required historical comparison is missing"],
      }),
      supportingEvidence: direction === DirectionState.DETERIORATING ? previousEvidence : currentEvidence,
      opposingEvidence: direction === DirectionState.DETERIORATING ? currentEvidence : previousEvidence,
      freshness,
      engineMeta,
    });
    validateContract("DirectionAssessment", output);
    return output;
  });
  return deepFreeze(outputs);
}
