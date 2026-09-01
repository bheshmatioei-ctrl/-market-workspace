import { FlowMode, FlowState, SCHEMA_VERSION } from "../domain/constants.js";
import { validateContract } from "../contracts/validators.js";
import {
  asDerivedProxyEvidence,
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
import { MONEY_FLOW_RULE_PROFILE } from "./rules/profiles.js";

const average = (values) => values.reduce((sum, item) => sum + item, 0) / values.length;
const signal = (measurement, neutral, scale) => measurementValue(measurement) === null ? null : clamp((measurementValue(measurement) - neutral) / scale);

export function evaluateSectorMoneyFlow({ sectorSnapshots, assetFlowSnapshots = [], evaluatedAt, ruleProfile = MONEY_FLOW_RULE_PROFILE }) {
  sectorSnapshots.forEach((item) => validateContract("SectorSnapshot", item));
  assetFlowSnapshots.forEach((item) => validateContract("AssetFlowSnapshot", item));
  assertEvaluationTime(evaluatedAt, [...sectorSnapshots, ...assetFlowSnapshots]);
  const engineMeta = createEngineMeta(ruleProfile, evaluatedAt, { SectorSnapshot: sectorSnapshots[0]?.schemaVersion ?? SCHEMA_VERSION, AssetFlowSnapshot: assetFlowSnapshots[0]?.schemaVersion ?? SCHEMA_VERSION });

  return deepFreeze(sectorSnapshots.map((sector) => {
    const mappedDirect = assetFlowSnapshots.filter((flow) => flow.flowType === "DIRECT" && (flow.sectorId === sector.sectorId || flow.assetClass === sector.flowAssetClass));
    const proxySignals = [
      signal(sector.priceChangePct, 0, 1),
      signal(sector.relativeStrengthVsSPY, 0, 0.7),
      signal(sector.relativeVolume, 1, 0.5),
      signal(sector.breadthPctPositive, 50, 25),
      signal(sector.upDownVolumeRatio, 1, 0.7),
    ];
    const availableProxy = proxySignals.filter(Number.isFinite);
    const proxyScore = availableProxy.length >= ruleProfile.minimumProxyFamilies ? round(average(availableProxy)) : null;
    const directValues = mappedDirect.map((flow) => measurementValue(flow.flowValue)).filter(Number.isFinite);
    const directScore = directValues.length ? clamp(average(directValues)) : null;
    const conflict = Number.isFinite(proxyScore) && Number.isFinite(directScore) && Math.sign(proxyScore) !== 0 && Math.sign(directScore) !== 0 && Math.sign(proxyScore) !== Math.sign(directScore);
    const freshness = freshnessFromInputs([sector, ...mappedDirect], evaluatedAt, "Sector-flow input freshness");
    const usable = freshness.decisionGrade && (proxyScore !== null || directScore !== null);
    let score = directScore !== null && proxyScore !== null ? round((directScore + proxyScore) / 2) : directScore ?? proxyScore;
    let state = FlowState.NEUTRAL;
    if (!usable) state = FlowState.INSUFFICIENT;
    else if (conflict) state = FlowState.MIXED;
    else if (score >= ruleProfile.demandThreshold) state = FlowState.DEMAND;
    else if (score <= ruleProfile.sellingThreshold) state = FlowState.SELLING_PRESSURE;
    const directEvidence = mappedDirect.flatMap((flow) => flow.evidenceRefs.filter((item) => item.evidenceType === "DIRECT"));
    const proxyEvidence = sector.evidenceRefs.map((item) => asDerivedProxyEvidence(item, `${sector.snapshotId}:flow`));
    const output = deepFreeze({
      schemaVersion: SCHEMA_VERSION,
      assessmentId: `sector-flow:${sector.snapshotId}:${evaluatedAt}`,
      timestamp: evaluatedAt,
      scope: "SECTOR",
      scopeId: sector.sectorId,
      flowMode: directScore !== null && proxyScore !== null ? FlowMode.MIXED : directScore !== null ? FlowMode.DIRECT : FlowMode.PROXY,
      state,
      trafficLight: stateTrafficLight(state),
      score: state === FlowState.INSUFFICIENT ? null : score,
      directFlowValue: directScore !== null && freshness.decisionGrade ? round(average(directValues)) : null,
      currency: directScore !== null && freshness.decisionGrade ? mappedDirect[0].currency : null,
      reportingPeriod: directScore !== null && freshness.decisionGrade ? mappedDirect[0].flowPeriod : null,
      confidence: confidence({ coverage: availableProxy.length / proxySignals.length, conflicts: conflict ? 1 : 0, freshness, reasons: [`${availableProxy.length} participation/relative-strength/volume proxy families evaluated; price is never sufficient alone.`], degradedBy: proxyScore === null ? ["Insufficient non-price proxy participation"] : [] }),
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
