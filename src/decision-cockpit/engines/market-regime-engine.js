import { SCHEMA_VERSION, TrafficLight } from "../domain/constants.js";
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
import { MARKET_REGIME_RULE_PROFILE } from "./rules/profiles.js";

function ratio(numerator, denominator) {
  return Number.isFinite(numerator) && Number.isFinite(denominator) && denominator !== 0 ? numerator / denominator : null;
}

function boundedSignal(value, scale) {
  return Number.isFinite(value) ? clamp(value / scale) : null;
}

function flowSignal(assessment) {
  if (!assessment || assessment.state === "INSUFFICIENT") return null;
  return assessment.score;
}

export function evaluateMarketRegime({
  marketSnapshot,
  breadthSnapshot,
  sectorSnapshots = [],
  assetFlowSnapshots = [],
  assetFlowAssessments = [],
  globalRotationAssessments = [],
  evaluatedAt,
  ruleProfile = MARKET_REGIME_RULE_PROFILE,
}) {
  [marketSnapshot, breadthSnapshot].filter(Boolean).forEach((snapshot, index) => validateContract(index === 0 ? "MarketSnapshot" : "BreadthSnapshot", snapshot));
  sectorSnapshots.forEach((snapshot) => validateContract("SectorSnapshot", snapshot));
  assetFlowSnapshots.forEach((snapshot) => validateContract("AssetFlowSnapshot", snapshot));
  assetFlowAssessments.forEach((assessment) => validateContract("FlowAssessment", assessment));
  globalRotationAssessments.forEach((assessment) => validateContract("GlobalRotationAssessment", assessment));
  const snapshots = [marketSnapshot, breadthSnapshot, ...sectorSnapshots, ...assetFlowSnapshots];
  assertEvaluationTime(evaluatedAt, snapshots);
  const freshness = freshnessFromInputs(snapshots, evaluatedAt, "Market-regime input freshness");
  const engineMeta = createEngineMeta(ruleProfile, evaluatedAt, {
    MarketSnapshot: marketSnapshot?.schemaVersion ?? SCHEMA_VERSION,
    BreadthSnapshot: breadthSnapshot?.schemaVersion ?? SCHEMA_VERSION,
    SectorSnapshot: sectorSnapshots[0]?.schemaVersion ?? SCHEMA_VERSION,
    AssetFlowSnapshot: assetFlowSnapshots[0]?.schemaVersion ?? SCHEMA_VERSION,
    FlowAssessment: assetFlowAssessments[0]?.schemaVersion ?? SCHEMA_VERSION,
    GlobalRotationAssessment: globalRotationAssessments[0]?.schemaVersion ?? SCHEMA_VERSION,
  });

  const signals = [];
  const marketChange = marketSnapshot?.marketChangePct ?? null;
  signals.push({ family: "broad_market", value: boundedSignal(marketChange, 1), evidence: marketSnapshot?.evidenceRefs ?? [] });
  const adRatio = ratio(measurementValue(breadthSnapshot?.advancers), measurementValue(breadthSnapshot?.decliners));
  signals.push({ family: "breadth", value: adRatio === null ? null : clamp((adRatio - 1) / 0.7), evidence: breadthSnapshot?.evidenceRefs ?? [] });
  const volumeRatio = ratio(measurementValue(breadthSnapshot?.advancingVolume), measurementValue(breadthSnapshot?.decliningVolume));
  signals.push({ family: "advancing_declining_volume", value: volumeRatio === null ? null : clamp((volumeRatio - 1) / 0.7), evidence: breadthSnapshot?.evidenceRefs ?? [] });
  const highLowTotal = (measurementValue(breadthSnapshot?.newHighs) ?? 0) + (measurementValue(breadthSnapshot?.newLows) ?? 0);
  const highLowSignal = highLowTotal > 0 ? (measurementValue(breadthSnapshot.newHighs) - measurementValue(breadthSnapshot.newLows)) / highLowTotal : null;
  signals.push({ family: "new_highs_new_lows", value: highLowSignal, evidence: breadthSnapshot?.evidenceRefs ?? [] });
  const green = sectorSnapshots.filter((item) => item.state === TrafficLight.GREEN).length;
  const red = sectorSnapshots.filter((item) => item.state === TrafficLight.RED).length;
  signals.push({ family: "sector_participation", value: sectorSnapshots.length ? (green - red) / sectorSnapshots.length : null, evidence: sectorSnapshots.flatMap((item) => item.evidenceRefs) });
  const vix = measurementValue(marketSnapshot?.vix);
  signals.push({ family: "volatility", value: vix === null ? null : vix <= ruleProfile.lowVix ? 0.7 : vix >= ruleProfile.highVix ? -0.8 : 0, evidence: marketSnapshot?.evidenceRefs?.filter((item) => item.field.includes("vix")) ?? [] });
  const usableFlows = assetFlowAssessments.map(flowSignal).filter(Number.isFinite);
  const rawDirectFlows = assetFlowSnapshots.filter((item) => item.flowType === "DIRECT").map((item) => measurementValue(item.flowValue)).filter(Number.isFinite).map((item) => clamp(item));
  usableFlows.push(...rawDirectFlows);
  signals.push({ family: "capital_flow", value: usableFlows.length ? usableFlows.reduce((sum, item) => sum + item, 0) / usableFlows.length : null, evidence: [...assetFlowSnapshots.flatMap((item) => item.evidenceRefs), ...assetFlowAssessments.flatMap((item) => [...item.directEvidence, ...item.proxyEvidence])] });
  const rotationScores = globalRotationAssessments.filter((item) => item.state !== "INSUFFICIENT").map((item) => item.score).filter(Number.isFinite);
  signals.push({ family: "global_rotation", value: rotationScores.length ? rotationScores.reduce((sum, item) => sum + item, 0) / rotationScores.length : null, evidence: globalRotationAssessments.flatMap((item) => [...item.directEvidence, ...item.proxyEvidence]) });

  const available = signals.filter((item) => item.value !== null);
  const positive = available.filter((item) => item.value >= ruleProfile.conflictMagnitude);
  const negative = available.filter((item) => item.value <= -ruleProfile.conflictMagnitude);
  const score = available.length ? round(available.reduce((sum, item) => sum + item.value, 0) / available.length) : null;
  let state = "NEUTRAL";
  if (!freshness.decisionGrade || available.length < ruleProfile.minimumEvidenceFamilies) state = "UNKNOWN";
  else if (positive.length && negative.length) state = "CONFLICTED";
  else if (score >= ruleProfile.riskOnThreshold) state = "RISK_ON";
  else if (score <= ruleProfile.riskOffThreshold) state = "RISK_OFF";

  const supportingSignals = state === "RISK_OFF" ? available.filter((item) => item.value < 0) : available.filter((item) => item.value > 0);
  const opposingSignals = state === "RISK_OFF" ? available.filter((item) => item.value > 0) : available.filter((item) => item.value < 0);
  const supportingEvidence = [...new Map(supportingSignals.flatMap((item) => item.evidence).map((item) => [item.evidenceId, item])).values()];
  const opposingEvidence = [...new Map(opposingSignals.flatMap((item) => item.evidence).map((item) => [item.evidenceId, item])).values()];
  const output = deepFreeze({
    schemaVersion: SCHEMA_VERSION,
    decisionId: `market-regime:${marketSnapshot?.snapshotId ?? "missing"}:${evaluatedAt}`,
    timestamp: evaluatedAt,
    scope: "MARKET",
    scopeId: "US_MARKET",
    state,
    trafficLight: stateTrafficLight(state),
    score: state === "UNKNOWN" ? null : score,
    confidence: confidence({
      coverage: available.length / signals.length,
      conflicts: positive.length && negative.length ? 1 : 0,
      freshness,
      reasons: [`${available.length} independent evidence families evaluated under an experimental profile.`],
      degradedBy: available.length < signals.length ? [`${signals.length - available.length} evidence family/families unavailable`] : [],
    }),
    supportingEvidence,
    opposingEvidence,
    freshness,
    engineVersion: ruleProfile.engineVersion,
    engineMeta,
  });
  validateContract("DecisionState", output);
  return output;
}
