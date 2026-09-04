import {
  ALERT_SEVERITY_ORDER,
  canonicalPresentationValue,
  cockpitProjectionId,
  COCKPIT_PREMARKET_WINDOW_ORDER,
  COCKPIT_PROJECTION_MODULE_ID,
  COCKPIT_PROJECTION_VERSION,
  conflictDisplayRecordId,
  DIRECTION_ORDER,
  freshnessDisplayRecordId,
  GLOBAL_HORIZON_ORDER,
  lexicalCompare,
  orderedCompare,
  warningDisplayRecordId,
} from "../contracts/cockpit-presentation.js";
import { validateContract } from "../contracts/validators.js";
import {
  CockpitDisplayMode,
  FeatureLifecycle,
  FreshnessStatus,
  MyFocusStatus,
  SCHEMA_VERSION,
} from "../domain/constants.js";

const ALLOWED_INPUTS = Object.freeze([
  "marketContextBundle",
  "decisionState",
  "directionAssessments",
  "flowAssessments",
  "globalRotationAssessments",
  "alerts",
  "discoveryCandidates",
  "premarketSnapshot",
  "premarketWindowAssessments",
  "displayEvidence",
  "generatedAt",
]);

const DISPLAY_EVIDENCE_CONTRACTS = Object.freeze({
  marketSnapshots: "MarketSnapshot",
  breadthSnapshots: "BreadthSnapshot",
  sectorSnapshots: "SectorSnapshot",
  stockSnapshots: "StockSnapshot",
  assetFlowSnapshots: "AssetFlowSnapshot",
  futuresSnapshots: "FuturesSnapshot",
  premarketStockSnapshots: "PremarketStockSnapshot",
  catalystEvents: "CatalystEvent",
});

const EVIDENCE_FIELDS = new Set([
  "supportingEvidence",
  "opposingEvidence",
  "directEvidence",
  "proxyEvidence",
  "rawEvidence",
  "evidenceRefs",
]);

const CANONICAL_STRING_FIELDS = new Set(["sourceSnapshotIds", "catalystEventIds", "newsEventIds"]);

function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value).forEach(deepFreeze);
  }
  return value;
}

function objectIdentity(value) {
  return value?.bundleId ?? value?.decisionId ?? value?.assessmentId ?? value?.alertId ??
    value?.candidateId ?? value?.snapshotId ?? value?.eventId ?? null;
}

function normalizePresentationCopy(value, parentKey = "") {
  if (Array.isArray(value)) {
    const items = value.map((item) => normalizePresentationCopy(item));
    if (EVIDENCE_FIELDS.has(parentKey)) return items.sort((left, right) => lexicalCompare(left.evidenceId, right.evidenceId));
    if (CANONICAL_STRING_FIELDS.has(parentKey)) return [...new Set(items)].sort(lexicalCompare);
    return items;
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, normalizePresentationCopy(item, key)]));
  }
  return value;
}

function canonicalCopy(value) {
  return normalizePresentationCopy(structuredClone(value));
}

function assertGeneratedAt(generatedAt) {
  if (typeof generatedAt !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(generatedAt) || Number.isNaN(Date.parse(generatedAt))) {
    throw new TypeError("generatedAt must be an explicit UTC timestamp");
  }
}

function validateInputArray(items, contractName, label) {
  if (!Array.isArray(items)) throw new TypeError(`${label} must be an array`);
  items.forEach((item) => validateContract(contractName, item));
}

function uniqueByIdentity(items, label) {
  const byId = new Map();
  for (const original of items.filter(Boolean)) {
    const item = canonicalCopy(original);
    const identity = objectIdentity(item);
    if (typeof identity !== "string" || identity.length === 0) throw new Error(`${label} requires an approved non-empty object identity`);
    const bytes = canonicalPresentationValue(item);
    if (byId.has(identity) && byId.get(identity).bytes !== bytes) throw new Error(`Conflicting duplicate ${label} identity: ${identity}`);
    if (!byId.has(identity)) byId.set(identity, { item, bytes });
  }
  return [...byId.values()].map((entry) => entry.item);
}

function sortDirections(items) {
  return items.sort((left, right) => orderedCompare(DIRECTION_ORDER, left.horizon, right.horizon) || lexicalCompare(left.assessmentId, right.assessmentId));
}

function sortFlows(items) {
  return items.sort((left, right) => lexicalCompare(left.scope, right.scope) || lexicalCompare(left.scopeId, right.scopeId) || lexicalCompare(left.assessmentId, right.assessmentId));
}

function sortAlerts(items) {
  return items.sort((left, right) => lexicalCompare(left.createdAt, right.createdAt) ||
    orderedCompare(ALERT_SEVERITY_ORDER, left.severity, right.severity) || lexicalCompare(left.alertId, right.alertId));
}

function sortGlobal(items) {
  return items.sort((left, right) => lexicalCompare(left.countryOrRegion, right.countryOrRegion) ||
    orderedCompare(GLOBAL_HORIZON_ORDER, left.horizon, right.horizon) || lexicalCompare(left.assessmentId, right.assessmentId));
}

function sortDiscovery(items) {
  return items.sort((left, right) => lexicalCompare(left.symbol, right.symbol) || lexicalCompare(left.candidateId, right.candidateId));
}

function sortWindows(items) {
  return items.sort((left, right) => orderedCompare(COCKPIT_PREMARKET_WINDOW_ORDER, left.window, right.window) || lexicalCompare(left.assessmentId, right.assessmentId));
}

function normalizedDisplayEvidence(displayEvidence) {
  if (displayEvidence === undefined) return undefined;
  if (!displayEvidence || typeof displayEvidence !== "object" || Array.isArray(displayEvidence)) throw new TypeError("displayEvidence must be an object");
  const unknown = Object.keys(displayEvidence).filter((key) => !Object.hasOwn(DISPLAY_EVIDENCE_CONTRACTS, key));
  if (unknown.length) throw new Error(`Unsupported display evidence input: ${unknown.join(", ")}`);
  const result = {};
  for (const [field, contractName] of Object.entries(DISPLAY_EVIDENCE_CONTRACTS)) {
    const items = displayEvidence[field] ?? [];
    validateInputArray(items, contractName, `displayEvidence.${field}`);
    result[field] = uniqueByIdentity(items, contractName)
      .sort((left, right) => lexicalCompare(objectIdentity(left), objectIdentity(right)));
  }
  return result;
}

function allPresentationObjects({ market, premarket, globalCapital, discovery, displayEvidence }) {
  return [
    market.regime,
    ...market.directions,
    ...market.flow,
    ...market.assetFlow,
    ...market.alerts,
    premarket.snapshot,
    ...premarket.windows,
    ...globalCapital.assessments,
    ...discovery.candidates,
    ...Object.values(displayEvidence ?? {}).flatMap((items) => items),
  ].filter(Boolean);
}

function assertGlobalIdentityIntegrity(objects) {
  const identities = new Map();
  for (const object of objects) {
    const identity = objectIdentity(object);
    const bytes = canonicalPresentationValue(object);
    if (identities.has(identity) && identities.get(identity) !== bytes) throw new Error(`Conflicting duplicate source object identity: ${identity}`);
    identities.set(identity, bytes);
  }
}

function sourceMetadata(objects, bundle) {
  const engineVersions = [];
  const ruleProfiles = [];
  const metas = [
    ...(bundle?.generatedBy ?? []),
    ...objects.map((item) => item.engineMeta).filter(Boolean),
  ];
  for (const meta of metas) {
    if (meta.engineVersion) engineVersions.push(meta.engineVersion);
    if (meta.ruleProfileId) ruleProfiles.push(meta.ruleProfileId);
  }
  for (const item of objects) {
    if (!item.engineMeta && typeof item.engineVersion === "string" && item.engineVersion.length) engineVersions.push(item.engineVersion);
    if (typeof item.modelVersion === "string" && item.modelVersion.length) engineVersions.push(item.modelVersion);
  }
  return {
    sourceEngineVersions: [...new Set(engineVersions)].sort(lexicalCompare),
    sourceRuleProfiles: [...new Set(ruleProfiles)].sort(lexicalCompare),
  };
}

function freshnessRecords(objects) {
  const records = [];
  for (const item of objects) {
    if (!item.freshness) continue;
    const sourceObjectId = objectIdentity(item);
    const record = {
      recordId: freshnessDisplayRecordId({ sourceObjectId, status: item.freshness.status, assessedAt: item.freshness.assessedAt }),
      sourceObjectId,
      status: item.freshness.status,
      assessedAt: item.freshness.assessedAt,
      ageSeconds: item.freshness.ageSeconds,
      decisionGrade: item.freshness.decisionGrade,
      reason: item.freshness.reason,
    };
    records.push(record);
  }
  return uniqueByIdentity(records.map((item) => ({ ...item, snapshotId: item.recordId })), "FreshnessDisplayRecord")
    .map(({ snapshotId: _identity, ...item }) => item)
    .sort((left, right) => lexicalCompare(left.sourceObjectId, right.sourceObjectId) || lexicalCompare(left.recordId, right.recordId));
}

function conflictRecords(objects, bundle) {
  const records = [];
  if (bundle) {
    for (const description of bundle.conflicts) {
      const sourceObjectIds = [bundle.bundleId];
      records.push({
        conflictId: conflictDisplayRecordId({ sourceObjectIds, description }),
        sourceObjectIds,
        label: "CONFLICT",
        description,
        supportingEvidence: [],
        opposingEvidence: [],
      });
    }
  }
  for (const item of objects) {
    if (!Array.isArray(item.opposingEvidence) || item.opposingEvidence.length === 0) continue;
    const sourceObjectIds = [objectIdentity(item)];
    const description = `Explicit opposing evidence: ${sourceObjectIds[0]}`;
    records.push({
      conflictId: conflictDisplayRecordId({ sourceObjectIds, description }),
      sourceObjectIds,
      label: "CONFLICT",
      description,
      supportingEvidence: canonicalCopy(item.supportingEvidence ?? item.directEvidence ?? item.proxyEvidence ?? []),
      opposingEvidence: canonicalCopy(item.opposingEvidence),
    });
  }
  const byId = new Map();
  for (const record of records) byId.set(record.conflictId, record);
  return [...byId.values()].sort((left, right) => lexicalCompare(left.sourceObjectIds.join("|"), right.sourceObjectIds.join("|")) || lexicalCompare(left.conflictId, right.conflictId));
}

function explicitMissingReasons(value, path = "") {
  const results = [];
  if (Array.isArray(value)) {
    value.forEach((item, index) => results.push(...explicitMissingReasons(item, `${path}[${index}]`)));
    return results;
  }
  if (!value || typeof value !== "object") return results;
  if (Object.hasOwn(value, "value") && Object.hasOwn(value, "unit") && Object.hasOwn(value, "missingReason") && value.value === null && typeof value.missingReason === "string") {
    results.push({ sourceField: path || "measurement", message: value.missingReason });
    return results;
  }
  for (const [key, item] of Object.entries(value)) {
    if (["sourceMeta", "supportingEvidence", "opposingEvidence", "directEvidence", "proxyEvidence", "rawEvidence", "evidenceRefs"].includes(key)) continue;
    results.push(...explicitMissingReasons(item, path ? `${path}.${key}` : key));
  }
  return results;
}

function warningRecords(objects, bundle) {
  const records = [];
  const add = (sourceObjectId, sourceField, message) => {
    if (!message) return;
    records.push({
      warningId: warningDisplayRecordId({ sourceObjectId, sourceField, message }),
      sourceObjectId,
      message,
      sourceField,
    });
  };
  if (bundle) bundle.warnings.forEach((message) => add(bundle.bundleId, "warnings", message));
  for (const item of objects) {
    const sourceObjectId = objectIdentity(item);
    for (const message of item.confidence?.degradedBy ?? []) add(sourceObjectId, "confidence.degradedBy", message);
    if (item.freshness && item.freshness.status !== FreshnessStatus.LIVE) add(sourceObjectId, "freshness.status", `Freshness: ${item.freshness.status}`);
    if (item.engineMeta?.lifecycle) add(sourceObjectId, "engineMeta.lifecycle", `Lifecycle: ${item.engineMeta.lifecycle}`);
    explicitMissingReasons(item).forEach(({ sourceField, message }) => add(sourceObjectId, sourceField, message));
  }
  const byId = new Map();
  for (const record of records) byId.set(record.warningId, record);
  return [...byId.values()].sort((left, right) => lexicalCompare(left.sourceObjectId, right.sourceObjectId) || lexicalCompare(left.warningId, right.warningId));
}

export function buildCockpitProjection(options) {
  if (!options || typeof options !== "object" || Array.isArray(options)) throw new TypeError("Cockpit projection options are required");
  const unknown = Object.keys(options).filter((key) => !ALLOWED_INPUTS.includes(key));
  if (unknown.length) throw new Error(`Unsupported CockpitProjection input: ${unknown.join(", ")}`);
  const {
    marketContextBundle = null,
    decisionState = null,
    directionAssessments = [],
    flowAssessments = [],
    globalRotationAssessments = [],
    alerts = [],
    discoveryCandidates = [],
    premarketSnapshot = null,
    premarketWindowAssessments = [],
    displayEvidence,
    generatedAt,
  } = options;

  assertGeneratedAt(generatedAt);
  if (marketContextBundle !== null) validateContract("MarketContextBundle", marketContextBundle);
  if (decisionState !== null) validateContract("DecisionState", decisionState);
  validateInputArray(directionAssessments, "DirectionAssessment", "directionAssessments");
  validateInputArray(flowAssessments, "FlowAssessment", "flowAssessments");
  validateInputArray(globalRotationAssessments, "GlobalRotationAssessment", "globalRotationAssessments");
  validateInputArray(alerts, "Alert", "alerts");
  validateInputArray(discoveryCandidates, "DiscoveryCandidate", "discoveryCandidates");
  if (premarketSnapshot !== null) validateContract("PremarketSnapshot", premarketSnapshot);
  validateInputArray(premarketWindowAssessments, "PremarketWindowAssessment", "premarketWindowAssessments");

  const regimes = uniqueByIdentity([marketContextBundle?.marketDecisionState, decisionState], "DecisionState");
  if (regimes.length > 1) throw new Error("CockpitProjection requires at most one approved market regime identity");
  const directions = sortDirections(uniqueByIdentity([...(marketContextBundle?.directionAssessments ?? []), ...directionAssessments], "DirectionAssessment"));
  const flows = uniqueByIdentity([
    ...(marketContextBundle?.sectorFlowAssessments ?? []),
    ...(marketContextBundle?.assetFlowAssessments ?? []),
    ...flowAssessments,
  ], "FlowAssessment");
  const global = sortGlobal(uniqueByIdentity([...(marketContextBundle?.globalRotationAssessments ?? []), ...globalRotationAssessments], "GlobalRotationAssessment"));
  const candidates = sortDiscovery(uniqueByIdentity(discoveryCandidates, "DiscoveryCandidate"));
  const sortedAlerts = sortAlerts(uniqueByIdentity(alerts, "Alert"));
  const snapshots = uniqueByIdentity([premarketSnapshot], "PremarketSnapshot");
  const snapshot = snapshots[0] ?? null;
  const windows = sortWindows(uniqueByIdentity([...(snapshot?.windowAssessments ?? []), ...premarketWindowAssessments], "PremarketWindowAssessment"));
  const normalizedEvidence = normalizedDisplayEvidence(displayEvidence);

  const market = {
    regime: regimes[0] ?? null,
    directions,
    flow: sortFlows(flows.filter((item) => item.scope !== "ASSET_CLASS")),
    assetFlow: sortFlows(flows.filter((item) => item.scope === "ASSET_CLASS")),
    alerts: sortedAlerts,
  };
  const premarket = { snapshot, windows };
  const globalCapital = { assessments: global };
  const discovery = { candidates, myFocusStatus: MyFocusStatus.ANALYSIS_ENGINE_NOT_AUTHORIZED };
  const objects = allPresentationObjects({ market, premarket, globalCapital, discovery, displayEvidence: normalizedEvidence });
  assertGlobalIdentityIntegrity(objects);

  const sourceObjectIds = [...new Set([
    ...(marketContextBundle ? [marketContextBundle.bundleId, ...marketContextBundle.sourceSnapshotIds] : []),
    ...objects.map(objectIdentity),
  ])].sort(lexicalCompare);
  const metadata = sourceMetadata(objects, marketContextBundle);
  const projectionMeta = {
    projectionVersion: COCKPIT_PROJECTION_VERSION,
    deterministic: true,
    generatedAt,
    sourceEngineVersions: metadata.sourceEngineVersions,
    sourceRuleProfiles: metadata.sourceRuleProfiles,
    lifecycleDisplayMode: CockpitDisplayMode.VALIDATION_ONLY,
  };
  const projection = {
    schemaVersion: SCHEMA_VERSION,
    projectionId: cockpitProjectionId({ projectionVersion: COCKPIT_PROJECTION_VERSION, generatedAt, sourceObjectIds }),
    generatedAt,
    displayMode: CockpitDisplayMode.VALIDATION_ONLY,
    market,
    premarket,
    globalCapital,
    discovery,
    ...(normalizedEvidence ? { displayEvidence: normalizedEvidence } : {}),
    freshnessSummary: freshnessRecords(objects),
    conflicts: conflictRecords(objects, marketContextBundle),
    warnings: warningRecords(objects, marketContextBundle),
    sourceObjectIds,
    projectionMeta,
  };
  validateContract("CockpitProjection", projection);
  return deepFreeze(projection);
}

export const COCKPIT_PROJECTION_FEATURE = Object.freeze({
  moduleId: COCKPIT_PROJECTION_MODULE_ID,
  projectionVersion: COCKPIT_PROJECTION_VERSION,
  featureLifecycle: FeatureLifecycle.SHADOW,
  displayMode: CockpitDisplayMode.VALIDATION_ONLY,
  deterministic: true,
});
