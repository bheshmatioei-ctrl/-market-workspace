import { FlowMode, FlowState, FreshnessStatus, SCHEMA_VERSION, TrafficLight } from "../domain/constants.js";
import { validateContract } from "../contracts/validators.js";
import { assertEvaluationTime, clamp, confidence, createEngineMeta, deepFreeze, freshnessFromInputs, measurementValue, round, stateTrafficLight } from "./engine-utils.js";
import { US_ASSET_FLOW_RULE_PROFILE } from "./rules/profiles.js";

const proxySignal = (state) => state === TrafficLight.GREEN ? 0.6 : state === TrafficLight.RED ? -0.6 : state === TrafficLight.ORANGE ? 0 : null;

export function evaluateUSAssetFlows({ assetFlowSnapshots, evaluatedAt, ruleProfile = US_ASSET_FLOW_RULE_PROFILE }) {
  assetFlowSnapshots.forEach((item) => validateContract("AssetFlowSnapshot", item));
  assertEvaluationTime(evaluatedAt, assetFlowSnapshots);
  const engineMeta = createEngineMeta(ruleProfile, evaluatedAt, { AssetFlowSnapshot: assetFlowSnapshots[0]?.schemaVersion ?? SCHEMA_VERSION });
  return deepFreeze(ruleProfile.requiredAssetClasses.map((assetClass) => {
    const inputs = assetFlowSnapshots.filter((item) => item.assetClass === assetClass);
    const direct = inputs.filter((item) => item.flowType === "DIRECT");
    const proxy = inputs.filter((item) => item.flowType === "PROXY");
    const freshness = freshnessFromInputs(inputs, evaluatedAt, `${assetClass} flow freshness`);
    const directValues = direct.map((item) => measurementValue(item.flowValue)).filter(Number.isFinite);
    const directScore = directValues.length ? clamp(directValues.reduce((sum, item) => sum + item, 0) / directValues.length) : null;
    const proxyScores = proxy.map((item) => proxySignal(item.proxyState)).filter(Number.isFinite);
    const proxyScoreValue = proxyScores.length ? proxyScores.reduce((sum, item) => sum + item, 0) / proxyScores.length : null;
    const conflict = directScore !== null && proxyScoreValue !== null && Math.sign(directScore) !== 0 && Math.sign(proxyScoreValue) !== 0 && Math.sign(directScore) !== Math.sign(proxyScoreValue);
    const usable = inputs.length && freshness.decisionGrade && (directScore !== null || proxyScoreValue !== null);
    const score = directScore !== null && proxyScoreValue !== null ? round((directScore + proxyScoreValue) / 2) : directScore ?? proxyScoreValue;
    let state = FlowState.NEUTRAL;
    if (!usable) state = FlowState.INSUFFICIENT;
    else if (conflict) state = FlowState.MIXED;
    else if (score > 0.2) state = FlowState.DEMAND;
    else if (score < -0.2) state = FlowState.SELLING_PRESSURE;
    const directEvidence = direct.flatMap((item) => item.evidenceRefs.filter((evidence) => evidence.evidenceType === "DIRECT"));
    const proxyEvidence = proxy.flatMap((item) => item.evidenceRefs.filter((evidence) => ["PROXY", "DERIVED"].includes(evidence.evidenceType)));
    const firstDirect = direct[0];
    const reportingPeriod = firstDirect ? `${firstDirect.flowPeriod}:${firstDirect.sourceMeta.reportingPeriodStart ?? "unknown"}/${firstDirect.sourceMeta.reportingPeriodEnd ?? "unknown"}` : null;
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
      currency: directScore !== null && freshness.decisionGrade ? firstDirect.currency : null,
      reportingPeriod: directScore !== null && freshness.decisionGrade ? reportingPeriod : null,
      confidence: confidence({ coverage: Math.min(1, inputs.length / 2), conflicts: conflict ? 1 : 0, freshness, reasons: [inputs.length ? "Direct and proxy channels were evaluated separately." : "Required asset class input is absent."], degradedBy: inputs.length ? [] : ["Missing asset-class evidence"] }),
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
