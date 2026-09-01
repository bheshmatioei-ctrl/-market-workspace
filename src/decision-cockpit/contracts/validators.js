import {
  AssessmentHorizon,
  DirectionState,
  EvidenceType,
  FeatureLifecycle,
  FlowMode,
  FlowState,
  FreshnessStatus,
  GlobalRotationState,
  SessionPhase,
  TrafficLight,
  enumValues,
} from "../domain/constants.js";

const SOURCE_TYPES = ["official", "exchange", "regulator", "vendor", "aggregator", "derived"];
const LATENCY_CLASSES = ["realtime", "delayed", "daily", "weekly", "monthly", "quarterly"];
const FLOW_TYPES = [EvidenceType.DIRECT, EvidenceType.PROXY];

export class ContractValidationError extends Error {
  constructor(contractName, issues) {
    super(`${contractName} validation failed: ${issues.join("; ")}`);
    this.name = "ContractValidationError";
    this.contractName = contractName;
    this.issues = issues;
  }
}

const isRecord = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const isUtcTimestamp = (value) => {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value)) return false;
  return !Number.isNaN(Date.parse(value));
};

function issueIf(condition, issues, message) {
  if (condition) issues.push(message);
}

function validateBase(value, issues) {
  issueIf(!isRecord(value), issues, "must be an object");
  if (!isRecord(value)) return;
  issueIf(typeof value.schemaVersion !== "string" || value.schemaVersion.length === 0, issues, "schemaVersion is required");
}

function requireString(value, field, issues) {
  issueIf(typeof value[field] !== "string" || value[field].length === 0, issues, `${field} must be a non-empty string`);
}

function requireUtc(value, field, issues, { nullable = false } = {}) {
  if (nullable && value[field] === null) return;
  issueIf(!isUtcTimestamp(value[field]), issues, `${field} must be a UTC ISO-8601 timestamp`);
}

function requireEnum(value, field, allowed, issues) {
  issueIf(!allowed.includes(value[field]), issues, `${field} must be one of ${allowed.join(", ")}`);
}

function requireArray(value, field, issues) {
  issueIf(!Array.isArray(value[field]), issues, `${field} must be an array`);
}

function requireNullableNumber(value, field, issues) {
  issueIf(value[field] !== null && (typeof value[field] !== "number" || !Number.isFinite(value[field])), issues, `${field} must be a finite number or null`);
}

function requireNullableString(value, field, issues) {
  issueIf(value[field] !== null && typeof value[field] !== "string", issues, `${field} must be a string or null`);
}

function requireBoundedScore(value, field, issues) {
  issueIf(value[field] !== null && (typeof value[field] !== "number" || !Number.isFinite(value[field]) || value[field] < -1 || value[field] > 1), issues, `${field} must be between -1 and 1 or null`);
}

function validateMeasurement(value, field, issues, { nullable = false } = {}) {
  const measurement = value[field];
  if (nullable && measurement === null) return;
  if (!isRecord(measurement)) {
    issues.push(`${field} must be a Measurement object${nullable ? " or null" : ""}`);
    return;
  }
  issueIf(measurement.value !== null && (typeof measurement.value !== "number" || !Number.isFinite(measurement.value)), issues, `${field}.value must be finite or null`);
  issueIf(typeof measurement.unit !== "string" || measurement.unit.length === 0, issues, `${field}.unit is required`);
  issueIf(measurement.value === null && (typeof measurement.missingReason !== "string" || measurement.missingReason.length === 0), issues, `${field}.missingReason is required when value is null`);
  issueIf(measurement.value !== null && measurement.missingReason !== null, issues, `${field}.missingReason must be null when value exists`);
}

export function validateSourceMeta(value) {
  const issues = [];
  validateBase(value, issues);
  if (isRecord(value)) {
    ["sourceId", "sourceName"].forEach((field) => requireString(value, field, issues));
    requireEnum(value, "sourceType", SOURCE_TYPES, issues);
    requireUtc(value, "observedAt", issues, { nullable: true });
    requireUtc(value, "receivedAt", issues, { nullable: true });
    if (value.reportingPeriodStart != null) requireUtc(value, "reportingPeriodStart", issues);
    if (value.reportingPeriodEnd != null) requireUtc(value, "reportingPeriodEnd", issues);
    requireEnum(value, "latencyClass", LATENCY_CLASSES, issues);
    requireNullableNumber(value, "freshnessSeconds", issues);
    issueIf(typeof value.isStale !== "boolean", issues, "isStale must be boolean");
    issueIf(typeof value.qualityScore !== "number" || value.qualityScore < 0 || value.qualityScore > 1, issues, "qualityScore must be between 0 and 1");
  }
  if (issues.length) throw new ContractValidationError("SourceMeta", issues);
  return value;
}

export function validateEvidenceRef(value) {
  const issues = [];
  validateBase(value, issues);
  if (isRecord(value)) {
    ["evidenceId", "field"].forEach((field) => requireString(value, field, issues));
    try { validateSourceMeta(value.sourceMeta); } catch (error) { issues.push(...error.issues.map((item) => `sourceMeta.${item}`)); }
    issueIf(!["number", "string", "boolean"].includes(typeof value.value) && value.value !== null, issues, "value must be scalar or null");
    issueIf(value.unit !== null && typeof value.unit !== "string", issues, "unit must be string or null");
    requireEnum(value, "evidenceType", enumValues(EvidenceType), issues);
  }
  if (issues.length) throw new ContractValidationError("EvidenceRef", issues);
  return value;
}

export function validateConfidence(value) {
  const issues = [];
  validateBase(value, issues);
  if (isRecord(value)) {
    issueIf(typeof value.score !== "number" || value.score < 0 || value.score > 1, issues, "score must be between 0 and 1");
    requireArray(value, "reasons", issues);
    requireArray(value, "degradedBy", issues);
  }
  if (issues.length) throw new ContractValidationError("Confidence", issues);
  return value;
}

export function validateFreshnessAssessment(value) {
  const issues = [];
  validateBase(value, issues);
  if (isRecord(value)) {
    requireEnum(value, "status", enumValues(FreshnessStatus), issues);
    requireUtc(value, "assessedAt", issues);
    requireNullableNumber(value, "ageSeconds", issues);
    requireString(value, "reason", issues);
    issueIf(typeof value.decisionGrade !== "boolean", issues, "decisionGrade must be boolean");
    issueIf([FreshnessStatus.STALE, FreshnessStatus.UNAVAILABLE].includes(value.status) && value.decisionGrade, issues, "stale/unavailable data cannot be decision-grade");
  }
  if (issues.length) throw new ContractValidationError("FreshnessAssessment", issues);
  return value;
}

function validateEngineMetaFields(value, issues) {
  issueIf(!isRecord(value), issues, "must be an object");
  if (!isRecord(value)) return;
  ["engineId", "engineVersion", "ruleProfileId"].forEach((field) => requireString(value, field, issues));
  requireEnum(value, "lifecycle", enumValues(FeatureLifecycle), issues);
  requireUtc(value, "evaluatedAt", issues);
  issueIf(!isRecord(value.inputSchemaVersions), issues, "inputSchemaVersions must be an object map");
  if (isRecord(value.inputSchemaVersions)) {
    Object.entries(value.inputSchemaVersions).forEach(([key, version]) => {
      issueIf(key.length === 0 || typeof version !== "string" || version.length === 0, issues, "inputSchemaVersions keys and values must be non-empty strings");
    });
  }
  issueIf(value.deterministic !== true, issues, "deterministic must be true for Package 002 engine metadata");
}

export function validateEngineMeta(value) {
  const issues = [];
  validateEngineMetaFields(value, issues);
  if (issues.length) throw new ContractValidationError("EngineMeta", issues);
  return value;
}

function validateEvidenceArray(value, issues, field = "evidenceRefs") {
  requireArray(value, field, issues);
  if (Array.isArray(value[field])) {
    value[field].forEach((item, index) => {
      try { validateEvidenceRef(item); } catch (error) { issues.push(...error.issues.map((entry) => `${field}[${index}].${entry}`)); }
    });
  }
}

function validateSnapshotBase(value, issues) {
  validateBase(value, issues);
  if (!isRecord(value)) return;
  requireString(value, "snapshotId", issues);
  requireUtc(value, "timestamp", issues);
  validateEvidenceArray(value, issues);
}

function validateMarketSnapshot(value, issues) {
  validateSnapshotBase(value, issues);
  if (!isRecord(value)) return;
  requireString(value, "sessionDate", issues);
  requireEnum(value, "sessionPhase", enumValues(SessionPhase), issues);
  ["spy", "qqq", "iwm", "dia", "vix", "ust2y", "ust10y", "dxy", "gold", "oil"].forEach((field) => validateMeasurement(value, field, issues));
  validateMeasurement(value, "bitcoinOptional", issues, { nullable: true });
  try { validateFreshnessAssessment(value.freshness); } catch (error) { issues.push(...error.issues.map((entry) => `freshness.${entry}`)); }
}

function validateBreadthSnapshot(value, issues) {
  validateSnapshotBase(value, issues);
  if (!isRecord(value)) return;
  requireEnum(value, "venue", ["NYSE", "NASDAQ", "US_COMPOSITE"], issues);
  ["advancers", "decliners", "unchanged", "advancingVolume", "decliningVolume", "newHighs", "newLows"].forEach((field) => validateMeasurement(value, field, issues));
  if (value.pctAbove50DMA != null) validateMeasurement(value, "pctAbove50DMA", issues);
  if (value.pctAbove200DMA != null) validateMeasurement(value, "pctAbove200DMA", issues);
}

function validateSectorSnapshot(value, issues) {
  validateSnapshotBase(value, issues);
  if (!isRecord(value)) return;
  ["sectorId", "benchmarkSymbol"].forEach((field) => requireString(value, field, issues));
  ["priceChangePct", "relativeStrengthVsSPY", "relativeVolume"].forEach((field) => validateMeasurement(value, field, issues));
  if (value.breadthPctPositive != null) validateMeasurement(value, "breadthPctPositive", issues);
  if (value.upDownVolumeRatio != null) validateMeasurement(value, "upDownVolumeRatio", issues);
  requireEnum(value, "state", enumValues(TrafficLight), issues);
  try { validateConfidence(value.confidence); } catch (error) { issues.push(...error.issues.map((entry) => `confidence.${entry}`)); }
}

function validateStockSnapshot(value, issues) {
  validateSnapshotBase(value, issues);
  if (!isRecord(value)) return;
  requireString(value, "symbol", issues);
  ["price", "priorClose", "changePct", "volume"].forEach((field) => validateMeasurement(value, field, issues));
  ["avgVolume", "relativeVolume", "dollarVolume", "vwap", "distanceFromVWAPPct", "dayHigh", "dayLow", "relativeStrengthVsBenchmark"].forEach((field) => {
    if (value[field] != null) validateMeasurement(value, field, issues);
  });
  requireArray(value, "newsEventIds", issues);
  try { validateFreshnessAssessment(value.freshness); } catch (error) { issues.push(...error.issues.map((entry) => `freshness.${entry}`)); }
}

function validateAssetFlowSnapshot(value, issues) {
  validateSnapshotBase(value, issues);
  if (!isRecord(value)) return;
  requireEnum(value, "assetClass", ["US_EQUITY", "US_BOND", "MONEY_MARKET", "GOLD", "COMMODITY", "HIGH_YIELD", "TECH_ETF", "OTHER"], issues);
  requireEnum(value, "flowPeriod", ["intraday", "daily", "weekly", "monthly"], issues);
  requireEnum(value, "flowType", FLOW_TYPES, issues);
  validateMeasurement(value, "flowValue", issues, { nullable: true });
  if (value.flowType === EvidenceType.PROXY) issueIf(value.flowValue !== null, issues, "PROXY flowValue must be null; proxy metrics belong in evidenceRefs");
  if (value.flowType === EvidenceType.DIRECT) issueIf(value.flowValue === null, issues, "DIRECT flowValue is required");
  if (value.proxyState != null) requireEnum(value, "proxyState", enumValues(TrafficLight), issues);
  requireString(value, "methodologyId", issues);
  try { validateConfidence(value.confidence); } catch (error) { issues.push(...error.issues.map((entry) => `confidence.${entry}`)); }
  try { validateSourceMeta(value.sourceMeta); } catch (error) { issues.push(...error.issues.map((entry) => `sourceMeta.${entry}`)); }
}

function validateCountryFlowSnapshot(value, issues) {
  validateSnapshotBase(value, issues);
  if (!isRecord(value)) return;
  requireString(value, "countryOrRegion", issues);
  requireEnum(value, "horizon", ["overnight", "1d", "5d", "1m", "structural"], issues);
  validateMeasurement(value, "equityFlowValue", issues, { nullable: true });
  validateMeasurement(value, "bondFlowValue", issues, { nullable: true });
  issueIf(typeof value.directFlowAvailable !== "boolean", issues, "directFlowAvailable must be boolean");
  if (!value.directFlowAvailable) issueIf(value.equityFlowValue !== null || value.bondFlowValue !== null, issues, "direct flow values must be null when directFlowAvailable is false");
  ["proxyRotationState", "fxState", "sovereignBondState", "relativeStrengthState", "compositeState"].forEach((field) => requireEnum(value, field, enumValues(TrafficLight), issues));
  try { validateConfidence(value.confidence); } catch (error) { issues.push(...error.issues.map((entry) => `confidence.${entry}`)); }
}

function validatePremarketSnapshot(value, issues) {
  validateSnapshotBase(value, issues);
  if (!isRecord(value)) return;
  requireString(value, "sessionDate", issues);
  ["futuresState", "macroRiskState", "globalMarketState", "participationState", "compositeState"].forEach((field) => requireEnum(value, field, enumValues(TrafficLight), issues));
  ["sectorStates", "focusStocks", "discoveredStocks", "scheduledEventIds", "newsEventIds"].forEach((field) => requireArray(value, field, issues));
  requireEnum(value, "directionState", enumValues(DirectionState), issues);
  try { validateConfidence(value.confidence); } catch (error) { issues.push(...error.issues.map((entry) => `confidence.${entry}`)); }
  try { validateFreshnessAssessment(value.freshness); } catch (error) { issues.push(...error.issues.map((entry) => `freshness.${entry}`)); }
}

function validateCatalystEvent(value, issues) {
  validateBase(value, issues);
  if (!isRecord(value)) return;
  requireString(value, "eventId", issues);
  requireUtc(value, "timestamp", issues);
  requireEnum(value, "eventType", ["macro", "fed", "earnings", "guidance", "sec", "mna", "analyst", "legal", "regulatory", "geopolitical", "commodity", "other"], issues);
  issueIf(typeof value.scheduled !== "boolean", issues, "scheduled must be boolean");
  if (value.scheduled) requireUtc(value, "scheduledAt", issues);
  try { validateSourceMeta(value.sourceMeta); } catch (error) { issues.push(...error.issues.map((entry) => `sourceMeta.${entry}`)); }
  ["headline", "summary", "factualImpact"].forEach((field) => requireString(value, field, issues));
  ["affectedSymbols", "affectedSectors"].forEach((field) => requireArray(value, field, issues));
  try { validateConfidence(value.confidence); } catch (error) { issues.push(...error.issues.map((entry) => `confidence.${entry}`)); }
}

function validateAlert(value, issues) {
  validateBase(value, issues);
  if (!isRecord(value)) return;
  ["alertId", "type", "interpretation", "modelVersion"].forEach((field) => requireString(value, field, issues));
  requireUtc(value, "createdAt", issues);
  requireEnum(value, "severity", ["info", "watch", "warning", "critical"], issues);
  issueIf(typeof value.marketWide !== "boolean", issues, "marketWide must be boolean");
  requireArray(value, "rawEvidence", issues);
  requireEnum(value, "trafficLight", enumValues(TrafficLight), issues);
  try { validateConfidence(value.confidence); } catch (error) { issues.push(...error.issues.map((entry) => `confidence.${entry}`)); }
}

function validateDecisionState(value, issues) {
  validateBase(value, issues);
  if (!isRecord(value)) return;
  ["decisionId", "scopeId", "engineVersion"].forEach((field) => requireString(value, field, issues));
  requireUtc(value, "timestamp", issues);
  requireEnum(value, "scope", ["MARKET", "SECTOR", "STOCK", "PREMARKET", "GLOBAL_ROTATION"], issues);
  requireEnum(value, "state", ["ACCUMULATION", "BUY_PRESSURE", "NEUTRAL", "CONFLICTED", "DISTRIBUTION", "SELL_PRESSURE", "WAIT_EVENT_RISK", "RISK_ON", "RISK_OFF", "UNKNOWN"], issues);
  requireEnum(value, "trafficLight", enumValues(TrafficLight), issues);
  issueIf(value.score !== null && (typeof value.score !== "number" || !Number.isFinite(value.score)), issues, "score must be finite or null");
  try { validateConfidence(value.confidence); } catch (error) { issues.push(...error.issues.map((entry) => `confidence.${entry}`)); }
  validateEvidenceArray(value, issues, "supportingEvidence");
  validateEvidenceArray(value, issues, "opposingEvidence");
  try { validateFreshnessAssessment(value.freshness); } catch (error) { issues.push(...error.issues.map((entry) => `freshness.${entry}`)); }
  if (value.engineMeta !== undefined) {
    try { validateEngineMeta(value.engineMeta); } catch (error) { issues.push(...error.issues.map((entry) => `engineMeta.${entry}`)); }
  }
  if (value.state === "UNKNOWN") issueIf(value.trafficLight !== TrafficLight.GREY, issues, "UNKNOWN decision state must be GREY");
}

function validateTradeDecisionZone(value, issues) {
  validateBase(value, issues);
  if (!isRecord(value)) return;
  ["zoneId", "symbol", "engineVersion"].forEach((field) => requireString(value, field, issues));
  requireUtc(value, "createdAt", issues);
  requireEnum(value, "zoneType", ["OPPORTUNITY", "CONDITIONAL", "PARTIAL_PROFIT", "EXIT_RISK", "HOLD", "INVALIDATION"], issues);
  validateMeasurement(value, "lowPrice", issues, { nullable: true });
  validateMeasurement(value, "highPrice", issues, { nullable: true });
  requireUtc(value, "validFrom", issues);
  if (value.validUntil != null) requireUtc(value, "validUntil", issues);
  ["conditions", "invalidationConditions"].forEach((field) => requireArray(value, field, issues));
  try { validateConfidence(value.confidence); } catch (error) { issues.push(...error.issues.map((entry) => `confidence.${entry}`)); }
}

function validatePredictionRecord(value, issues) {
  validateBase(value, issues);
  if (!isRecord(value)) return;
  ["predictionId", "scope", "symbolOrScopeId", "modelVersion", "horizon", "predictedDirection", "marketRegimeAtIssue", "evidenceSnapshotHash"].forEach((field) => requireString(value, field, issues));
  requireUtc(value, "issuedAt", issues);
  validateMeasurement(value, "referencePrice", issues, { nullable: true });
  ["expectedMoveLowPct", "expectedMoveHighPct"].forEach((field) => requireNullableNumber(value, field, issues));
  try { validateConfidence(value.confidence); } catch (error) { issues.push(...error.issues.map((entry) => `confidence.${entry}`)); }
  validateEvidenceArray(value, issues);
}

function validatePredictionOutcome(value, issues) {
  validateBase(value, issues);
  if (!isRecord(value)) return;
  ["predictionId", "actualDirection", "evaluationRuleVersion"].forEach((field) => requireString(value, field, issues));
  requireUtc(value, "evaluatedAt", issues);
  ["actualMovePct", "maxFavorableExcursionPct", "maxAdverseExcursionPct", "magnitudeError"].forEach((field) => requireNullableNumber(value, field, issues));
  issueIf(value.actualMovePct === null, issues, "actualMovePct is required");
  issueIf(typeof value.pass !== "boolean", issues, "pass must be boolean");
}

function validateDirectionAssessment(value, issues) {
  validateBase(value, issues);
  if (!isRecord(value)) return;
  ["assessmentId", "scopeId"].forEach((field) => requireString(value, field, issues));
  requireUtc(value, "timestamp", issues);
  requireEnum(value, "scope", ["MARKET", "SECTOR", "STOCK"], issues);
  requireEnum(value, "horizon", enumValues(AssessmentHorizon), issues);
  requireEnum(value, "direction", enumValues(DirectionState), issues);
  requireBoundedScore(value, "score", issues);
  requireEnum(value, "trafficLight", enumValues(TrafficLight), issues);
  try { validateConfidence(value.confidence); } catch (error) { issues.push(...error.issues.map((entry) => `confidence.${entry}`)); }
  validateEvidenceArray(value, issues, "supportingEvidence");
  validateEvidenceArray(value, issues, "opposingEvidence");
  try { validateFreshnessAssessment(value.freshness); } catch (error) { issues.push(...error.issues.map((entry) => `freshness.${entry}`)); }
  try { validateEngineMeta(value.engineMeta); } catch (error) { issues.push(...error.issues.map((entry) => `engineMeta.${entry}`)); }
  if (value.direction === DirectionState.UNKNOWN) {
    issueIf(value.trafficLight !== TrafficLight.GREY, issues, "UNKNOWN direction requires GREY");
    issueIf(value.score !== null, issues, "UNKNOWN direction requires score=null");
  }
}

function validateTypedEvidenceArray(value, field, allowedTypes, issues) {
  validateEvidenceArray(value, issues, field);
  if (Array.isArray(value[field])) {
    value[field].forEach((evidence, index) => issueIf(!allowedTypes.includes(evidence.evidenceType), issues, `${field}[${index}] has invalid evidenceType ${evidence.evidenceType}`));
  }
}

function validateFlowAssessment(value, issues) {
  validateBase(value, issues);
  if (!isRecord(value)) return;
  ["assessmentId", "scopeId"].forEach((field) => requireString(value, field, issues));
  requireUtc(value, "timestamp", issues);
  requireEnum(value, "scope", ["MARKET", "SECTOR", "ASSET_CLASS"], issues);
  requireEnum(value, "flowMode", enumValues(FlowMode), issues);
  requireEnum(value, "state", enumValues(FlowState), issues);
  requireEnum(value, "trafficLight", enumValues(TrafficLight), issues);
  requireBoundedScore(value, "score", issues);
  requireNullableNumber(value, "directFlowValue", issues);
  requireNullableString(value, "currency", issues);
  requireNullableString(value, "reportingPeriod", issues);
  try { validateConfidence(value.confidence); } catch (error) { issues.push(...error.issues.map((entry) => `confidence.${entry}`)); }
  validateTypedEvidenceArray(value, "directEvidence", [EvidenceType.DIRECT], issues);
  validateTypedEvidenceArray(value, "proxyEvidence", [EvidenceType.PROXY, EvidenceType.DERIVED], issues);
  validateEvidenceArray(value, issues, "opposingEvidence");
  try { validateFreshnessAssessment(value.freshness); } catch (error) { issues.push(...error.issues.map((entry) => `freshness.${entry}`)); }
  try { validateEngineMeta(value.engineMeta); } catch (error) { issues.push(...error.issues.map((entry) => `engineMeta.${entry}`)); }
  if (value.flowMode === FlowMode.PROXY) issueIf(value.directFlowValue !== null, issues, "PROXY mode requires directFlowValue=null");
  if (value.directFlowValue !== null) {
    issueIf(!Array.isArray(value.directEvidence) || value.directEvidence.length === 0, issues, "numeric directFlowValue requires DIRECT evidence");
    issueIf(value.currency === null, issues, "numeric directFlowValue requires currency");
    issueIf(value.reportingPeriod === null, issues, "numeric directFlowValue requires reportingPeriod");
  }
  if (value.state === FlowState.INSUFFICIENT) {
    issueIf(value.trafficLight !== TrafficLight.GREY, issues, "INSUFFICIENT flow requires GREY");
    issueIf(value.score !== null, issues, "INSUFFICIENT flow requires score=null");
  }
}

function validateGlobalRotationAssessment(value, issues) {
  validateBase(value, issues);
  if (!isRecord(value)) return;
  ["assessmentId", "countryOrRegion"].forEach((field) => requireString(value, field, issues));
  requireUtc(value, "timestamp", issues);
  requireEnum(value, "horizon", ["overnight", "1d", "5d", "1m", "structural"], issues);
  requireEnum(value, "state", enumValues(GlobalRotationState), issues);
  requireEnum(value, "trafficLight", enumValues(TrafficLight), issues);
  requireBoundedScore(value, "score", issues);
  ["equityState", "bondState", "fxState", "relativeStrengthState", "directFlowState"].forEach((field) => requireEnum(value, field, enumValues(TrafficLight), issues));
  requireNullableNumber(value, "directFlowValue", issues);
  requireNullableString(value, "directFlowCurrency", issues);
  try { validateConfidence(value.confidence); } catch (error) { issues.push(...error.issues.map((entry) => `confidence.${entry}`)); }
  validateTypedEvidenceArray(value, "directEvidence", [EvidenceType.DIRECT], issues);
  validateTypedEvidenceArray(value, "proxyEvidence", [EvidenceType.PROXY, EvidenceType.DERIVED], issues);
  validateEvidenceArray(value, issues, "opposingEvidence");
  try { validateFreshnessAssessment(value.freshness); } catch (error) { issues.push(...error.issues.map((entry) => `freshness.${entry}`)); }
  try { validateEngineMeta(value.engineMeta); } catch (error) { issues.push(...error.issues.map((entry) => `engineMeta.${entry}`)); }
  if (value.directFlowValue !== null) {
    issueIf(!Array.isArray(value.directEvidence) || value.directEvidence.length === 0, issues, "numeric directFlowValue requires DIRECT evidence");
    issueIf(value.directFlowCurrency === null, issues, "numeric directFlowValue requires directFlowCurrency");
  }
  if (value.state === GlobalRotationState.INSUFFICIENT) {
    issueIf(value.trafficLight !== TrafficLight.GREY, issues, "INSUFFICIENT rotation requires GREY");
    issueIf(value.score !== null, issues, "INSUFFICIENT rotation requires score=null");
  }
}

function captureNestedIssues(label, validator, item, issues) {
  const nested = [];
  validator(item, nested);
  issues.push(...nested.map((entry) => `${label}.${entry}`));
}

function validateMarketContextBundle(value, issues) {
  validateBase(value, issues);
  if (!isRecord(value)) return;
  requireString(value, "bundleId", issues);
  requireUtc(value, "timestamp", issues);
  ["directionAssessments", "sectorFlowAssessments", "assetFlowAssessments", "globalRotationAssessments", "conflicts", "warnings", "sourceSnapshotIds", "generatedBy"].forEach((field) => requireArray(value, field, issues));
  for (const field of ["conflicts", "warnings", "sourceSnapshotIds"]) {
    if (Array.isArray(value[field])) value[field].forEach((item, index) => issueIf(typeof item !== "string" || item.length === 0, issues, `${field}[${index}] must be a non-empty string`));
  }
  if (value.marketDecisionState !== null) captureNestedIssues("marketDecisionState", validateDecisionState, value.marketDecisionState, issues);
  if (Array.isArray(value.directionAssessments)) value.directionAssessments.forEach((item, index) => captureNestedIssues(`directionAssessments[${index}]`, validateDirectionAssessment, item, issues));
  for (const field of ["sectorFlowAssessments", "assetFlowAssessments"]) {
    if (Array.isArray(value[field])) value[field].forEach((item, index) => captureNestedIssues(`${field}[${index}]`, validateFlowAssessment, item, issues));
  }
  if (Array.isArray(value.globalRotationAssessments)) value.globalRotationAssessments.forEach((item, index) => captureNestedIssues(`globalRotationAssessments[${index}]`, validateGlobalRotationAssessment, item, issues));
  if (Array.isArray(value.generatedBy)) value.generatedBy.forEach((item, index) => {
    try { validateEngineMeta(item); } catch (error) { issues.push(...error.issues.map((entry) => `generatedBy[${index}].${entry}`)); }
  });
}

const validators = {
  EngineMeta: (value, issues) => validateEngineMetaFields(value, issues),
  MarketSnapshot: validateMarketSnapshot,
  BreadthSnapshot: validateBreadthSnapshot,
  SectorSnapshot: validateSectorSnapshot,
  StockSnapshot: validateStockSnapshot,
  AssetFlowSnapshot: validateAssetFlowSnapshot,
  CountryFlowSnapshot: validateCountryFlowSnapshot,
  PremarketSnapshot: validatePremarketSnapshot,
  CatalystEvent: validateCatalystEvent,
  Alert: validateAlert,
  DecisionState: validateDecisionState,
  TradeDecisionZone: validateTradeDecisionZone,
  PredictionRecord: validatePredictionRecord,
  PredictionOutcome: validatePredictionOutcome,
  DirectionAssessment: validateDirectionAssessment,
  FlowAssessment: validateFlowAssessment,
  GlobalRotationAssessment: validateGlobalRotationAssessment,
  MarketContextBundle: validateMarketContextBundle,
};

export const supportedContractNames = Object.freeze(Object.keys(validators));

export function validateContract(contractName, value) {
  const validator = validators[contractName];
  if (!validator) throw new Error(`Unsupported contract: ${contractName}`);
  const issues = [];
  validator(value, issues);
  if (issues.length) throw new ContractValidationError(contractName, issues);
  return value;
}

export function validateFeatureLifecycle(value) {
  if (!enumValues(FeatureLifecycle).includes(value)) throw new Error(`Invalid feature lifecycle: ${value}`);
  return value;
}
