import { GlobalRotationState, SCHEMA_VERSION, TrafficLight } from "../domain/constants.js";
import { validateContract } from "../contracts/validators.js";
import { assertEvaluationTime, clamp, confidence, createEngineMeta, deepFreeze, freshnessFromInputs, measurementValue, round, signedTrafficLight, stateTrafficLight } from "./engine-utils.js";
import { GLOBAL_ROTATION_RULE_PROFILE } from "./rules/profiles.js";

const trafficSignal = (value) => value === TrafficLight.GREEN ? 1 : value === TrafficLight.RED ? -1 : value === TrafficLight.ORANGE ? 0 : null;

export function evaluateGlobalCapitalRotation({ countryFlowSnapshots, evaluatedAt, ruleProfile = GLOBAL_ROTATION_RULE_PROFILE }) {
  countryFlowSnapshots.forEach((item) => validateContract("CountryFlowSnapshot", item));
  assertEvaluationTime(evaluatedAt, countryFlowSnapshots);
  const engineMeta = createEngineMeta(ruleProfile, evaluatedAt, { CountryFlowSnapshot: countryFlowSnapshots[0]?.schemaVersion ?? SCHEMA_VERSION });

  return deepFreeze(countryFlowSnapshots.map((snapshot) => {
    const directEvidenceAll = snapshot.evidenceRefs.filter((item) => item.evidenceType === "DIRECT");
    const compatibleLatencies = ruleProfile.compatibleLatencyByHorizon[snapshot.horizon];
    const directEvidence = directEvidenceAll.filter((item) => compatibleLatencies.includes(item.sourceMeta.latencyClass) && !item.sourceMeta.isStale);
    const excludedDirect = directEvidenceAll.filter((item) => !directEvidence.includes(item));
    const proxyEvidence = snapshot.evidenceRefs.filter((item) => ["PROXY", "DERIVED"].includes(item.evidenceType));
    const equityValue = measurementValue(snapshot.equityFlowValue);
    const bondValue = measurementValue(snapshot.bondFlowValue);
    const directRaw = [equityValue, bondValue].filter(Number.isFinite);
    const directUsable = snapshot.directFlowAvailable && directRaw.length > 0 && directEvidence.length > 0;
    const directValue = directUsable ? round(directRaw.reduce((sum, item) => sum + item, 0)) : null;
    const components = [snapshot.proxyRotationState, snapshot.fxState, snapshot.sovereignBondState, snapshot.relativeStrengthState].map(trafficSignal).filter(Number.isFinite);
    if (directUsable) components.push(clamp(directValue));
    const positive = components.filter((item) => item > 0).length;
    const negative = components.filter((item) => item < 0).length;
    const freshness = freshnessFromInputs([snapshot], evaluatedAt, `${snapshot.countryOrRegion} rotation freshness`);
    const sufficient = freshness.decisionGrade && components.length >= ruleProfile.minimumProxyComponents;
    const score = components.length ? round(components.reduce((sum, item) => sum + item, 0) / components.length) : null;
    let state = GlobalRotationState.NEUTRAL;
    if (!sufficient) state = GlobalRotationState.INSUFFICIENT;
    else if (positive && negative) state = GlobalRotationState.MIXED;
    else if (score >= ruleProfile.positiveThreshold) state = GlobalRotationState.POSITIVE_ROTATION;
    else if (score <= ruleProfile.negativeThreshold) state = GlobalRotationState.NEGATIVE_ROTATION;
    const directFlowState = directUsable ? signedTrafficLight(directValue) : TrafficLight.GREY;
    const output = deepFreeze({
      schemaVersion: SCHEMA_VERSION,
      assessmentId: `global-rotation:${snapshot.snapshotId}:${evaluatedAt}`,
      timestamp: evaluatedAt,
      countryOrRegion: snapshot.countryOrRegion,
      horizon: snapshot.horizon,
      state,
      trafficLight: stateTrafficLight(state),
      score: state === GlobalRotationState.INSUFFICIENT ? null : score,
      equityState: equityValue !== null && directUsable ? signedTrafficLight(equityValue) : snapshot.proxyRotationState,
      bondState: bondValue !== null && directUsable ? signedTrafficLight(bondValue) : snapshot.sovereignBondState,
      fxState: snapshot.fxState,
      relativeStrengthState: snapshot.relativeStrengthState,
      directFlowState,
      directFlowValue: directValue,
      directFlowCurrency: directValue === null ? null : "USD",
      confidence: confidence({
        coverage: components.length / 5,
        conflicts: positive && negative ? 1 : 0,
        freshness,
        reasons: [`${components.length} horizon-compatible components evaluated; absent direct flow was not treated as negative.`],
        degradedBy: [
          ...(!snapshot.directFlowAvailable ? ["Direct flow unavailable"] : []),
          ...(excludedDirect.length ? ["Direct evidence excluded for horizon/frequency mismatch or staleness"] : []),
        ],
      }),
      directEvidence,
      proxyEvidence,
      opposingEvidence: [...excludedDirect, ...(positive && negative ? proxyEvidence : [])],
      freshness,
      engineMeta,
    });
    validateContract("GlobalRotationAssessment", output);
    return output;
  }));
}
