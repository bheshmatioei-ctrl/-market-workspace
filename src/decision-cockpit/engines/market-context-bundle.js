import { FeatureLifecycle, SCHEMA_VERSION } from "../domain/constants.js";
import { validateContract } from "../contracts/validators.js";
import { createEngineMeta, deepFreeze, immutableClone } from "./engine-utils.js";
import { BUNDLE_RULE_PROFILE } from "./rules/profiles.js";

function uniqueSorted(values) {
  return [...new Set(values)].sort();
}

export function assembleMarketContextBundle({
  marketDecisionState = null,
  directionAssessments = [],
  sectorFlowAssessments = [],
  assetFlowAssessments = [],
  globalRotationAssessments = [],
  sourceSnapshotIds = [],
  evaluatedAt,
  ruleProfile = BUNDLE_RULE_PROFILE,
}) {
  if (marketDecisionState) validateContract("DecisionState", marketDecisionState);
  directionAssessments.forEach((item) => validateContract("DirectionAssessment", item));
  [...sectorFlowAssessments, ...assetFlowAssessments].forEach((item) => validateContract("FlowAssessment", item));
  globalRotationAssessments.forEach((item) => validateContract("GlobalRotationAssessment", item));
  const childMetas = [marketDecisionState, ...directionAssessments, ...sectorFlowAssessments, ...assetFlowAssessments, ...globalRotationAssessments]
    .map((item) => item?.engineMeta).filter(Boolean);
  if (childMetas.some((meta) => meta.lifecycle !== FeatureLifecycle.SHADOW)) throw new Error("Package 002 bundle accepts SHADOW engine outputs only.");
  const ownMeta = createEngineMeta(ruleProfile, evaluatedAt, {
    DecisionState: SCHEMA_VERSION,
    DirectionAssessment: SCHEMA_VERSION,
    FlowAssessment: SCHEMA_VERSION,
    GlobalRotationAssessment: SCHEMA_VERSION,
  });
  const generatedBy = [...new Map([...childMetas, ownMeta].map((meta) => [`${meta.engineId}:${meta.engineVersion}`, meta])).values()];
  const conflicts = [];
  const warnings = [];
  [...sectorFlowAssessments, ...assetFlowAssessments].forEach((item) => {
    if (item.state === "MIXED") conflicts.push(`${item.scope}:${item.scopeId}:DIRECT_PROXY_OR_PROXY_COMPONENT_CONFLICT`);
    if (item.state === "INSUFFICIENT") warnings.push(`${item.scope}:${item.scopeId}:INSUFFICIENT_FLOW`);
  });
  globalRotationAssessments.forEach((item) => {
    if (item.state === "MIXED") conflicts.push(`GLOBAL:${item.countryOrRegion}:${item.horizon}:COMPONENT_CONFLICT`);
    if (item.state === "INSUFFICIENT") warnings.push(`GLOBAL:${item.countryOrRegion}:${item.horizon}:INSUFFICIENT`);
  });
  directionAssessments.filter((item) => item.direction === "UNKNOWN").forEach((item) => warnings.push(`DIRECTION:${item.horizon}:UNKNOWN`));
  if (marketDecisionState?.state === "UNKNOWN") warnings.push("MARKET_REGIME:UNKNOWN");
  const usRotation = globalRotationAssessments.find((item) => ["United States", "US", "USA"].includes(item.countryOrRegion));
  const usEquity = assetFlowAssessments.find((item) => item.scopeId === "US_EQUITY");
  const usRotationPositive = usRotation && ["POSITIVE_ROTATION"].includes(usRotation.state);
  const usRotationNegative = usRotation && ["NEGATIVE_ROTATION"].includes(usRotation.state);
  const usFlowPositive = usEquity && usEquity.state === "DEMAND";
  const usFlowNegative = usEquity && usEquity.state === "SELLING_PRESSURE";
  if ((usRotationPositive && usFlowNegative) || (usRotationNegative && usFlowPositive)) conflicts.push("GLOBAL_US_VS_US_EQUITY_FLOW_DISAGREEMENT");

  const bundle = deepFreeze({
    schemaVersion: SCHEMA_VERSION,
    bundleId: `market-context:${evaluatedAt}`,
    timestamp: evaluatedAt,
    marketDecisionState: marketDecisionState ? immutableClone(marketDecisionState) : null,
    directionAssessments: immutableClone(directionAssessments),
    sectorFlowAssessments: immutableClone(sectorFlowAssessments),
    assetFlowAssessments: immutableClone(assetFlowAssessments),
    globalRotationAssessments: immutableClone(globalRotationAssessments),
    conflicts: Object.freeze(uniqueSorted(conflicts)),
    warnings: Object.freeze(uniqueSorted(warnings)),
    sourceSnapshotIds: Object.freeze(uniqueSorted(sourceSnapshotIds)),
    generatedBy: immutableClone(generatedBy),
  });
  validateContract("MarketContextBundle", bundle);
  return bundle;
}
