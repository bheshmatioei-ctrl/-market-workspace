import {
  AnomalyType,
  AssessmentHorizon,
  CatalystImpactTier,
  DirectionState,
  EvidenceType,
  FeatureLifecycle,
  FlowMode,
  FlowState,
  FreshnessStatus,
  FuturesInstrument,
  GlobalRotationState,
  LiquidityQuality,
  PremarketFreezeStatus,
  PremarketWindow,
  SessionPhase,
  TrafficLight,
  enumValues,
} from "../domain/constants.js";
import { ANOMALY_TYPE_ORDER, discoveryCandidateId } from "./anomaly-discovery.js";
import {
  PREMARKET_WINDOW_ORDER,
  parsePremarketAssessmentId,
  premarketSnapshotId,
} from "./premarket-intelligence.js";

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
const lexicalCompare = (left, right) => left < right ? -1 : left > right ? 1 : 0;
const isUtcTimestamp = (value) => {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value)) return false;
  return !Number.isNaN(Date.parse(value));
};
const isSessionDate = (value) => {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
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
  issueIf(value.deterministic !== true, issues, "deterministic must be true for analytical engine metadata");
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

function validateSessionIdentityFields(value, issues) {
  if (!isRecord(value)) {
    issues.push("sessionIdentity must be an object");
    return;
  }
  issueIf(!isSessionDate(value.sessionDate), issues, "sessionIdentity.sessionDate must use YYYY-MM-DD");
  requireEnum(value, "sessionPhase", enumValues(SessionPhase), issues);
  requireString(value, "sessionCalendarId", issues);
}

export function validateSessionIdentity(value) {
  const issues = [];
  validateSessionIdentityFields(value, issues);
  if (issues.length) throw new ContractValidationError("SessionIdentity", issues);
  return value;
}

function validateOptionalSessionIdentity(value, issues) {
  if (value.sessionIdentity === undefined) return;
  const nested = [];
  validateSessionIdentityFields(value.sessionIdentity, nested);
  issues.push(...nested);
}

function validateMarketSnapshot(value, issues) {
  validateSnapshotBase(value, issues);
  if (!isRecord(value)) return;
  requireString(value, "sessionDate", issues);
  requireEnum(value, "sessionPhase", enumValues(SessionPhase), issues);
  validateOptionalSessionIdentity(value, issues);
  if (isRecord(value.sessionIdentity)) {
    issueIf(value.sessionDate !== value.sessionIdentity.sessionDate, issues, "sessionDate must match sessionIdentity.sessionDate");
    issueIf(value.sessionPhase !== value.sessionIdentity.sessionPhase, issues, "sessionPhase must match sessionIdentity.sessionPhase");
  }
  ["spy", "qqq", "iwm", "dia", "vix", "ust2y", "ust10y", "dxy", "gold", "oil"].forEach((field) => validateMeasurement(value, field, issues));
  validateMeasurement(value, "bitcoinOptional", issues, { nullable: true });
  try { validateFreshnessAssessment(value.freshness); } catch (error) { issues.push(...error.issues.map((entry) => `freshness.${entry}`)); }
}

function validateBreadthSnapshot(value, issues) {
  validateSnapshotBase(value, issues);
  if (!isRecord(value)) return;
  requireEnum(value, "venue", ["NYSE", "NASDAQ", "US_COMPOSITE"], issues);
  validateOptionalSessionIdentity(value, issues);
  ["advancers", "decliners", "unchanged", "advancingVolume", "decliningVolume", "newHighs", "newLows"].forEach((field) => validateMeasurement(value, field, issues));
  if (value.pctAbove50DMA != null) validateMeasurement(value, "pctAbove50DMA", issues);
  if (value.pctAbove200DMA != null) validateMeasurement(value, "pctAbove200DMA", issues);
}

function validateSectorSnapshot(value, issues) {
  validateSnapshotBase(value, issues);
  if (!isRecord(value)) return;
  ["sectorId", "benchmarkSymbol"].forEach((field) => requireString(value, field, issues));
  validateOptionalSessionIdentity(value, issues);
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
  const extensionFields = ["sessionIdentity", "windowAssessments", "supportingEvidence", "opposingEvidence", "sourceSnapshotIds", "regularOpenTimestamp", "freezeStatus", "frozenAt", "engineMeta"];
  if (extensionFields.some((field) => value[field] !== undefined)) validatePremarketSnapshotExtension(value, issues);
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
  if (value.impactTier !== undefined) requireEnum(value, "impactTier", enumValues(CatalystImpactTier), issues);
  try { validateConfidence(value.confidence); } catch (error) { issues.push(...error.issues.map((entry) => `confidence.${entry}`)); }
}

function validateAlert(value, issues) {
  validateBase(value, issues);
  if (!isRecord(value)) return;
  ["alertId", "type", "interpretation", "modelVersion"].forEach((field) => requireString(value, field, issues));
  requireUtc(value, "createdAt", issues);
  requireEnum(value, "severity", ["info", "watch", "warning", "critical"], issues);
  issueIf(typeof value.marketWide !== "boolean", issues, "marketWide must be boolean");
  validateEvidenceArray(value, issues, "rawEvidence");
  requireEnum(value, "trafficLight", enumValues(TrafficLight), issues);
  try { validateConfidence(value.confidence); } catch (error) { issues.push(...error.issues.map((entry) => `confidence.${entry}`)); }
}

function validateCanonicalStringArray(value, field, issues, { nonEmpty = false } = {}) {
  requireArray(value, field, issues);
  if (!Array.isArray(value[field])) return;
  value[field].forEach((item, index) => issueIf(typeof item !== "string" || item.length === 0, issues, `${field}[${index}] must be a non-empty string`));
  if (nonEmpty) issueIf(value[field].length === 0, issues, `${field} must be non-empty`);
  if (value[field].every((item) => typeof item === "string")) {
    const canonical = [...new Set(value[field])].sort(lexicalCompare);
    issueIf(JSON.stringify(value[field]) !== JSON.stringify(canonical), issues, `${field} must be unique and canonically ordered`);
  }
}

function validateCanonicalEvidenceArray(value, field, issues, { nonEmpty = false } = {}) {
  validateEvidenceArray(value, issues, field);
  if (!Array.isArray(value[field])) return;
  if (nonEmpty) issueIf(value[field].length === 0, issues, `${field} must be non-empty`);
  const ids = value[field].map((item) => item?.evidenceId);
  if (ids.every((item) => typeof item === "string")) {
    const canonical = [...new Set(ids)].sort(lexicalCompare);
    issueIf(JSON.stringify(ids) !== JSON.stringify(canonical), issues, `${field} must be unique and ordered by evidenceId`);
  }
}

function validateMarketSessionBoundary(value, issues) {
  validateBase(value, issues);
  if (!isRecord(value)) return;
  issueIf(!isSessionDate(value.sessionDate), issues, "sessionDate must use YYYY-MM-DD");
  requireString(value, "sessionCalendarId", issues);
  const timestampFields = [
    "priorRegularCloseTimestamp",
    "afterhoursEndTimestamp",
    "premarketStartTimestamp",
    "regularOpenTimestamp",
  ];
  timestampFields.forEach((field) => requireUtc(value, field, issues));
  validateCanonicalEvidenceArray(value, "evidenceRefs", issues, { nonEmpty: true });
  if (timestampFields.every((field) => isUtcTimestamp(value[field]))) {
    const [priorClose, afterhoursEnd, premarketStart, regularOpen] = timestampFields.map((field) => Date.parse(value[field]));
    issueIf(!(priorClose < afterhoursEnd && afterhoursEnd <= premarketStart && premarketStart < regularOpen), issues,
      "session timestamps must satisfy priorRegularCloseTimestamp < afterhoursEndTimestamp <= premarketStartTimestamp < regularOpenTimestamp");
  }
}

function validateFuturesSnapshot(value, issues) {
  validateBase(value, issues);
  if (!isRecord(value)) return;
  requireString(value, "snapshotId", issues);
  requireUtc(value, "timestamp", issues);
  validateSessionIdentityFields(value.sessionIdentity, issues);
  requireEnum(value, "instrument", enumValues(FuturesInstrument), issues);
  ["lastPrice", "priorCashClose", "changePctFromPriorCashClose", "volume"].forEach((field) => validateMeasurement(value, field, issues));
  if (isRecord(value.lastPrice) && isRecord(value.priorCashClose)) {
    issueIf(value.lastPrice.unit !== value.priorCashClose.unit, issues, "lastPrice and priorCashClose must use compatible units");
  }
  if (isRecord(value.changePctFromPriorCashClose)) issueIf(value.changePctFromPriorCashClose.unit !== "percent", issues, "changePctFromPriorCashClose.unit must be percent");
  try { validateFreshnessAssessment(value.freshness); } catch (error) { issues.push(...error.issues.map((entry) => `freshness.${entry}`)); }
  validateCanonicalEvidenceArray(value, "evidenceRefs", issues, { nonEmpty: true });
}

function validatePremarketStockSnapshot(value, issues) {
  validateBase(value, issues);
  if (!isRecord(value)) return;
  ["snapshotId", "symbol"].forEach((field) => requireString(value, field, issues));
  requireUtc(value, "timestamp", issues);
  validateSessionIdentityFields(value.sessionIdentity, issues);
  if (isRecord(value.sessionIdentity)) issueIf(value.sessionIdentity.sessionPhase !== SessionPhase.PREMARKET, issues, "PremarketStockSnapshot sessionPhase must be premarket");
  ["priorClose", "premarketPrice", "gapPct", "premarketVolume", "relativePremarketVolume", "dollarVolume"].forEach((field) => validateMeasurement(value, field, issues));
  if (isRecord(value.priorClose) && isRecord(value.premarketPrice)) issueIf(value.priorClose.unit !== value.premarketPrice.unit, issues, "priorClose and premarketPrice must use compatible units");
  if (isRecord(value.gapPct)) issueIf(value.gapPct.unit !== "percent", issues, "gapPct.unit must be percent");
  requireNullableString(value, "sectorId", issues);
  validateCanonicalStringArray(value, "catalystEventIds", issues);
  requireEnum(value, "liquidityQuality", enumValues(LiquidityQuality), issues);
  try { validateFreshnessAssessment(value.freshness); } catch (error) { issues.push(...error.issues.map((entry) => `freshness.${entry}`)); }
  validateCanonicalEvidenceArray(value, "evidenceRefs", issues, { nonEmpty: true });
}

function validatePremarketWindowAssessment(value, issues) {
  validateBase(value, issues);
  if (!isRecord(value)) return;
  requireString(value, "assessmentId", issues);
  requireUtc(value, "timestamp", issues);
  requireEnum(value, "window", enumValues(PremarketWindow), issues);
  requireEnum(value, "state", enumValues(TrafficLight), issues);
  requireEnum(value, "direction", enumValues(DirectionState), issues);
  try { validateConfidence(value.confidence); } catch (error) { issues.push(...error.issues.map((entry) => `confidence.${entry}`)); }
  try { validateFreshnessAssessment(value.freshness); } catch (error) { issues.push(...error.issues.map((entry) => `freshness.${entry}`)); }
  validateCanonicalEvidenceArray(value, "supportingEvidence", issues);
  validateCanonicalEvidenceArray(value, "opposingEvidence", issues);
  validateCanonicalStringArray(value, "sourceSnapshotIds", issues);
  try { validateEngineMeta(value.engineMeta); } catch (error) { issues.push(...error.issues.map((entry) => `engineMeta.${entry}`)); }
  if (isRecord(value.engineMeta)) {
    issueIf(value.engineMeta.lifecycle !== FeatureLifecycle.SHADOW, issues, "Package 004 PremarketWindowAssessment lifecycle must be SHADOW");
    issueIf(value.timestamp !== value.engineMeta.evaluatedAt, issues, "timestamp must equal engineMeta.evaluatedAt");
  }
  const identity = parsePremarketAssessmentId(value.assessmentId);
  issueIf(identity === null, issues, "assessmentId must use the approved deterministic identity format");
  if (identity && isRecord(value.engineMeta)) {
    issueIf(identity.engineVersion !== value.engineMeta.engineVersion, issues, "assessmentId engineVersion must match engineMeta");
    issueIf(identity.ruleProfileId !== value.engineMeta.ruleProfileId, issues, "assessmentId ruleProfileId must match engineMeta");
    issueIf(identity.evaluatedAt !== value.timestamp, issues, "assessmentId evaluatedAt must match timestamp");
    issueIf(!isSessionDate(identity.sessionDate), issues, "assessmentId sessionDate must use YYYY-MM-DD");
    issueIf(typeof identity.sessionCalendarId !== "string" || identity.sessionCalendarId.length === 0, issues, "assessmentId sessionCalendarId is required");
    issueIf(identity.window !== value.window, issues, "assessmentId window must match window");
  }
  if (value.direction === DirectionState.UNKNOWN) issueIf(value.state !== TrafficLight.GREY, issues, "UNKNOWN direction requires GREY state");
}

function validatePremarketSnapshotExtension(value, issues) {
  const requiredFields = ["sessionIdentity", "windowAssessments", "supportingEvidence", "opposingEvidence", "sourceSnapshotIds", "regularOpenTimestamp", "freezeStatus", "frozenAt", "engineMeta"];
  requiredFields.forEach((field) => issueIf(value[field] === undefined, issues, `Package 004 extension field ${field} is required`));
  validateSessionIdentityFields(value.sessionIdentity, issues);
  if (isRecord(value.sessionIdentity)) issueIf(value.sessionDate !== value.sessionIdentity.sessionDate, issues, "sessionDate must match sessionIdentity.sessionDate");
  requireArray(value, "windowAssessments", issues);
  if (Array.isArray(value.windowAssessments)) {
    value.windowAssessments.forEach((item, index) => captureNestedIssues(`windowAssessments[${index}]`, validatePremarketWindowAssessment, item, issues));
    issueIf(JSON.stringify(value.windowAssessments.map((item) => item?.window)) !== JSON.stringify(PREMARKET_WINDOW_ORDER), issues,
      "windowAssessments must contain AFTERHOURS, OVERNIGHT, PREMARKET in canonical order");
  }
  validateCanonicalEvidenceArray(value, "supportingEvidence", issues);
  validateCanonicalEvidenceArray(value, "opposingEvidence", issues);
  validateCanonicalStringArray(value, "sourceSnapshotIds", issues);
  requireUtc(value, "regularOpenTimestamp", issues);
  requireEnum(value, "freezeStatus", enumValues(PremarketFreezeStatus), issues);
  requireUtc(value, "frozenAt", issues, { nullable: true });
  try { validateEngineMeta(value.engineMeta); } catch (error) { issues.push(...error.issues.map((entry) => `engineMeta.${entry}`)); }
  if (isRecord(value.engineMeta)) {
    issueIf(value.engineMeta.lifecycle !== FeatureLifecycle.SHADOW, issues, "Package 004 PremarketSnapshot lifecycle must be SHADOW");
    issueIf(value.timestamp !== value.engineMeta.evaluatedAt, issues, "timestamp must equal engineMeta.evaluatedAt");
    if (isRecord(value.sessionIdentity)) {
      const expectedId = premarketSnapshotId({
        engineVersion: value.engineMeta.engineVersion,
        ruleProfileId: value.engineMeta.ruleProfileId,
        evaluatedAt: value.timestamp,
        sessionDate: value.sessionIdentity.sessionDate,
        sessionCalendarId: value.sessionIdentity.sessionCalendarId,
      });
      issueIf(value.snapshotId !== expectedId, issues, "snapshotId must match the approved deterministic identity tuple");
    }
  }
  if (value.freezeStatus === PremarketFreezeStatus.LIVE) {
    issueIf(value.frozenAt !== null, issues, "LIVE PremarketSnapshot requires frozenAt=null");
    if (isUtcTimestamp(value.timestamp) && isUtcTimestamp(value.regularOpenTimestamp)) issueIf(Date.parse(value.timestamp) >= Date.parse(value.regularOpenTimestamp), issues, "LIVE PremarketSnapshot timestamp must be before regularOpenTimestamp");
  }
  if (value.freezeStatus === PremarketFreezeStatus.FROZEN) {
    issueIf(value.frozenAt !== value.regularOpenTimestamp, issues, "FROZEN PremarketSnapshot requires frozenAt=regularOpenTimestamp");
    issueIf(value.timestamp !== value.regularOpenTimestamp, issues, "FROZEN PremarketSnapshot timestamp must equal regularOpenTimestamp");
  }
}

function validateDiscoveryCandidate(value, issues) {
  validateBase(value, issues);
  if (!isRecord(value)) return;
  ["candidateId", "symbol"].forEach((field) => requireString(value, field, issues));
  requireUtc(value, "timestamp", issues);
  requireArray(value, "anomalyTypes", issues);
  if (Array.isArray(value.anomalyTypes)) {
    issueIf(value.anomalyTypes.length === 0, issues, "anomalyTypes must be non-empty");
    value.anomalyTypes.forEach((type, index) => issueIf(!enumValues(AnomalyType).includes(type), issues, `anomalyTypes[${index}] is invalid`));
    const canonical = ANOMALY_TYPE_ORDER.filter((type) => value.anomalyTypes.includes(type));
    issueIf(JSON.stringify(value.anomalyTypes) !== JSON.stringify(canonical), issues, "anomalyTypes must be unique and canonically ordered");
  }
  requireEnum(value, "severity", ["info", "watch", "warning", "critical"], issues);
  try { validateConfidence(value.confidence); } catch (error) { issues.push(...error.issues.map((entry) => `confidence.${entry}`)); }
  validateCanonicalEvidenceArray(value, "supportingEvidence", issues, { nonEmpty: true });
  validateCanonicalEvidenceArray(value, "opposingEvidence", issues);
  validateCanonicalStringArray(value, "catalystEventIds", issues);
  validateCanonicalStringArray(value, "sourceSnapshotIds", issues, { nonEmpty: true });
  requireNullableString(value, "sectorId", issues);
  try { validateFreshnessAssessment(value.freshness); } catch (error) { issues.push(...error.issues.map((entry) => `freshness.${entry}`)); }
  try { validateEngineMeta(value.engineMeta); } catch (error) { issues.push(...error.issues.map((entry) => `engineMeta.${entry}`)); }
  if (isRecord(value.engineMeta)) {
    issueIf(value.engineMeta.lifecycle !== FeatureLifecycle.SHADOW, issues, "Package 003 DiscoveryCandidate lifecycle must be SHADOW");
    issueIf(value.engineMeta.evaluatedAt !== value.timestamp, issues, "timestamp must equal engineMeta.evaluatedAt");
    if ([value.engineMeta.engineVersion, value.engineMeta.ruleProfileId, value.timestamp, value.symbol].every((item) => typeof item === "string" && item.length > 0)) {
      const expectedId = discoveryCandidateId({
        engineVersion: value.engineMeta.engineVersion,
        ruleProfileId: value.engineMeta.ruleProfileId,
        timestamp: value.timestamp,
        symbol: value.symbol,
      });
      issueIf(value.candidateId !== expectedId, issues, "candidateId must match the approved deterministic identity tuple");
    }
  }
  if (isRecord(value.freshness) && value.freshness.decisionGrade === false) {
    issueIf(!Array.isArray(value.confidence?.degradedBy) || value.confidence.degradedBy.length === 0, issues, "non-decision-grade freshness must explicitly degrade confidence");
  }
  for (const forbidden of ["BUY", "SELL", "STRONG_BUY", "STRONG_SELL", "targetPrice", "positionSize", "orderType", "brokerAction"]) {
    issueIf(Object.hasOwn(value, forbidden), issues, `forbidden trade field: ${forbidden}`);
  }
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
  MarketSessionBoundary: validateMarketSessionBoundary,
  FuturesSnapshot: validateFuturesSnapshot,
  PremarketStockSnapshot: validatePremarketStockSnapshot,
  PremarketWindowAssessment: validatePremarketWindowAssessment,
  MarketSnapshot: validateMarketSnapshot,
  BreadthSnapshot: validateBreadthSnapshot,
  SectorSnapshot: validateSectorSnapshot,
  StockSnapshot: validateStockSnapshot,
  AssetFlowSnapshot: validateAssetFlowSnapshot,
  CountryFlowSnapshot: validateCountryFlowSnapshot,
  PremarketSnapshot: validatePremarketSnapshot,
  CatalystEvent: validateCatalystEvent,
  Alert: validateAlert,
  DiscoveryCandidate: validateDiscoveryCandidate,
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
