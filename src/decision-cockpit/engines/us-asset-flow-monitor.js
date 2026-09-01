import { FlowMode, FlowState, FreshnessStatus, SCHEMA_VERSION, TrafficLight } from "../domain/constants.js";
import { validateContract } from "../contracts/validators.js";
import { assertEvaluationTime, clamp, confidence, createEngineMeta, deepFreeze, freshnessFromInputs, measurementValue, round, stateTrafficLight } from "./engine-utils.js";
import { US_ASSET_FLOW_RULE_PROFILE } from "./rules/profiles.js";

const proxySignal = (state) => state === TrafficLight.GREEN ? 0.6 : state === TrafficLight.RED ? -0.6 : state === TrafficLight.ORANGE ? 0 : null;
const COMPATIBILITY_FIELDS = Object.freeze([
  ["assetClass", (item) => item.assetClass],
  ["currency", (item) => item.currency],
  ["flowPeriod", (item) => item.flowPeriod],
  ["sourceMeta.latencyClass", (item) => item.sourceMeta.latencyClass],
  ["sourceMeta.reportingPeriodStart", (item) => item.sourceMeta.reportingPeriodStart],
  ["sourceMeta.reportingPeriodEnd", (item) => item.sourceMeta.reportingPeriodEnd],
  ["flowValue.unit", (item) => item.flowValue?.unit],
]);

const uniqueEvidence = (items) => [...new Map(items.map((item) => [item.evidenceId, item])).values()]
  .sort((left, right) => left.evidenceId.localeCompare(right.evidenceId));

function incompatibleDirectDimensions(records) {
  if (records.length === 0) return [];
  const tupleIssues = COMPATIBILITY_FIELDS.flatMap(([field, read]) => {
    const values = records.map(read);
    const missing = values.some((value) => value === null || value === undefined || value === "");
    const distinct = new Set(values.map((value) => String(value)));
    return missing || distinct.size !== 1 ? [field] : [];
  });
  const missingDirectEvidence = records.some((item) => !item.evidenceRefs.some((evidence) => evidence.evidenceType === "DIRECT"));
  return missingDirectEvidence ? [...tupleIssues, "directEvidence"] : tupleIssues;
}

export function evaluateUSAssetFlows({ assetFlowSnapshots, evaluatedAt, ruleProfile = US_ASSET_FLOW_RULE_PROFILE }) {
  assetFlowSnapshots.forEach((item) => validateContract("AssetFlowSnapshot", item));
  assertEvaluationTime(evaluatedAt, assetFlowSnapshots);
  const engineMeta = createEngineMeta(ruleProfile, evaluatedAt, { AssetFlowSnapshot: assetFlowSnapshots[0]?.schemaVersion ?? SCHEMA_VERSION });
  return deepFreeze(ruleProfile.requiredAssetClasses.map((assetClass) => {
    const inputs = assetFlowSnapshots.filter((item) => item.assetClass === assetClass)
      .sort((left, right) => Date.parse(left.timestamp) - Date.parse(right.timestamp) || left.snapshotId.localeCompare(right.snapshotId));
    const direct = inputs.filter((item) => item.flowType === "DIRECT");
    const proxy = inputs.filter((item) => item.flowType === "PROXY");
    const freshness = freshnessFromInputs(inputs, evaluatedAt, `${assetClass} flow freshness`);
    const incompatibleDimensions = incompatibleDirectDimensions(direct);
    const directCompatible = incompatibleDimensions.length === 0;
    const directValues = direct.map((item) => measurementValue(item.flowValue)).filter(Number.isFinite);
    const directScore = directCompatible && directValues.length ? clamp(directValues.reduce((sum, item) => sum + item, 0) / directValues.length) : null;
    const proxyScores = proxy.map((item) => proxySignal(item.proxyState)).filter(Number.isFinite);
    const proxyScoreValue = proxyScores.length ? proxyScores.reduce((sum, item) => sum + item, 0) / proxyScores.length : null;
    const conflict = directScore !== null && proxyScoreValue !== null && Math.sign(directScore) !== 0 && Math.sign(proxyScoreValue) !== 0 && Math.sign(directScore) !== Math.sign(proxyScoreValue);
    const incompatibleDirect = direct.length > 0 && !directCompatible;
    const usable = !incompatibleDirect && inputs.length && freshness.decisionGrade && (directScore !== null || proxyScoreValue !== null);
    const score = directScore !== null && proxyScoreValue !== null ? round((directScore + proxyScoreValue) / 2) : directScore ?? proxyScoreValue;
    let state = FlowState.NEUTRAL;
    if (!usable) state = FlowState.INSUFFICIENT;
    else if (conflict) state = FlowState.MIXED;
    else if (score > 0.2) state = FlowState.DEMAND;
    else if (score < -0.2) state = FlowState.SELLING_PRESSURE;
    const directEvidence = uniqueEvidence(direct.flatMap((item) => item.evidenceRefs.filter((evidence) => evidence.evidenceType === "DIRECT")));
    const proxyEvidence = uniqueEvidence(proxy.flatMap((item) => item.evidenceRefs.filter((evidence) => ["PROXY", "DERIVED"].includes(evidence.evidenceType))));
    const commonDirect = directCompatible ? direct[0] : null;
    const reportingPeriod = commonDirect ? `${commonDirect.flowPeriod}:${commonDirect.sourceMeta.reportingPeriodStart}/${commonDirect.sourceMeta.reportingPeriodEnd}` : null;
    const incompatibilityReason = incompatibleDirect ? `Incompatible DIRECT aggregation: ${incompatibleDimensions.join(", ")}` : null;
    const output = deepFreeze({
      schemaVersion: SCHEMA_VERSION,
      assessmentId: `us-asset-flow:${assetClass}:${evaluatedAt}`,
      timestamp: evaluatedAt,
      scope: "ASSET_CLASS",
      scopeId: assetClass,
      flowMode: direct.length && proxy.length ? FlowMode.MIXED : direct.length ? FlowMode.DIRECT : FlowMode.PROXY,
      state,
      trafficLight: stateTrafficLight(state),
      score: state === FlowState.INSUFFICIENT ? null : score,
      directFlowValue: directScore !== null && freshness.decisionGrade ? round(directValues.reduce((sum, item) => sum + item, 0)) : null,
      currency: directScore !== null && freshness.decisionGrade ? commonDirect.currency : null,
      reportingPeriod: directScore !== null && freshness.decisionGrade ? reportingPeriod : null,
      confidence: confidence({
        coverage: incompatibleDirect ? 0 : Math.min(1, inputs.length / 2),
        conflicts: conflict || incompatibleDirect ? 1 : 0,
        freshness,
        reasons: [incompatibleDirect ? "Incompatible measured-flow records failed closed without aggregation." : inputs.length ? "Direct and proxy channels were evaluated separately." : "Required asset class input is absent."],
        degradedBy: incompatibleDirect ? [incompatibilityReason] : inputs.length ? [] : ["Missing asset-class evidence"],
      }),
      directEvidence,
      proxyEvidence,
      opposingEvidence: conflict ? [...directEvidence, ...proxyEvidence] : [],
      freshness,
      engineMeta,
    });
    validateContract("FlowAssessment", output);
    return output;
  }));
}
