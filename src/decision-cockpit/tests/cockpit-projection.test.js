import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { canonicalize, deserializeContract, deterministicSerialize } from "../contracts/serialization.js";
import { freshnessDisplayRecordId } from "../contracts/cockpit-presentation.js";
import { validateContract } from "../contracts/validators.js";
import { CockpitDisplayMode, FeatureLifecycle, FreshnessStatus } from "../domain/constants.js";
import { buildCockpitProjection, COCKPIT_PROJECTION_FEATURE } from "../projection/cockpit-projector.js";
import { COCKPIT_GENERATED_AT, COCKPIT_MOCK_DATA_NOTICE, COCKPIT_PROJECTION_SCENARIOS } from "../mocks/cockpit-projection-scenarios.js";
import { constructiveMarketSnapshot } from "../mocks/fixtures.js";
import { FeatureFlagRegistry } from "../state/feature-flags.js";
import { renderCockpitProjection, renderGlobalCapital, renderPremarket, renderUsAssetFlows } from "../ui/render-projection.js";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const run = (name = "CONSTRUCTIVE_MARKET") => buildCockpitProjection(COCKPIT_PROJECTION_SCENARIOS[name].input);

test("Package 005 exposes all 20 required deterministic MOCK scenarios", () => {
  assert.deepEqual(Object.keys(COCKPIT_PROJECTION_SCENARIOS), [
    "CONSTRUCTIVE_MARKET", "RISK_OFF_MARKET", "CONFLICTED_MARKET", "STALE_MARKET", "MISSING_MARKET_CONTEXT",
    "PREMARKET_LIVE", "PREMARKET_FROZEN", "PREMARKET_REVERSAL", "DIRECT_FLOW_AVAILABLE", "PROXY_ONLY_FLOW",
    "DIRECT_PROXY_CONFLICT", "GLOBAL_POSITIVE", "GLOBAL_NEGATIVE", "GLOBAL_MIXED_HORIZONS", "ALERT_STREAM",
    "MULTIPLE_DISCOVERY_CANDIDATES", "SHADOW_LIFECYCLE_VISIBILITY", "STALE_TO_GREY", "CONFLICT_EVIDENCE_VISIBLE", "DETERMINISTIC_PROJECTION",
  ]);
  Object.values(COCKPIT_PROJECTION_SCENARIOS).forEach((scenario) => assert.equal(scenario.notice, COCKPIT_MOCK_DATA_NOTICE));
});

test("CockpitProjection validates and canonically round-trips", () => {
  const projection = run();
  validateContract("CockpitProjection", projection);
  const bytes = deterministicSerialize("CockpitProjection", projection);
  assert.equal(deterministicSerialize("CockpitProjection", deserializeContract("CockpitProjection", bytes)), bytes);
});

test("all Package 005 presentation support contracts validate", () => {
  const projection = run();
  for (const [name, value] of [
    ["CockpitMarketView", projection.market], ["CockpitPremarketView", projection.premarket],
    ["CockpitGlobalCapitalView", projection.globalCapital], ["CockpitDiscoveryView", projection.discovery],
    ["ProjectionMeta", projection.projectionMeta], ["FreshnessDisplayRecord", projection.freshnessSummary[0]],
    ["ConflictDisplayRecord", projection.conflicts[0]], ["WarningDisplayRecord", projection.warnings[0]],
  ]) validateContract(name, value);
});

test("optional CockpitDisplayEvidence validates normalized display-only inputs", () => {
  const projection = buildCockpitProjection({ ...COCKPIT_PROJECTION_SCENARIOS.CONSTRUCTIVE_MARKET.input, displayEvidence: { marketSnapshots: [constructiveMarketSnapshot] } });
  validateContract("CockpitDisplayEvidence", projection.displayEvidence);
  assert.equal(projection.displayEvidence.marketSnapshots[0].snapshotId, constructiveMarketSnapshot.snapshotId);
});

test("same inputs and explicit generatedAt produce byte-identical projections and IDs", () => {
  const first = run();
  const second = run();
  assert.equal(canonicalize(first), canonicalize(second));
  assert.equal(first.projectionId, second.projectionId);
});

test("reordered semantically unordered inputs produce identical projection", () => {
  assert.equal(canonicalize(run()), canonicalize(run("DETERMINISTIC_PROJECTION")));
});

test("canonical direction, alert, global, discovery and premarket ordering is retained", () => {
  const projection = run("DETERMINISTIC_PROJECTION");
  assert.deepEqual(projection.market.directions.map((item) => item.horizon), ["30m", "60m", "120m", "SESSION"]);
  assert.deepEqual(projection.market.alerts.map((item) => item.symbol), ["AAA", "ZZZ"]);
  assert.deepEqual(projection.discovery.candidates.map((item) => item.symbol), ["AAA", "ZZZ"]);
  assert.deepEqual(projection.premarket.windows.map((item) => item.window), ["AFTERHOURS", "OVERNIGHT", "PREMARKET"]);
  assert.deepEqual(projection.sourceObjectIds, [...projection.sourceObjectIds].sort());
});

test("engine versions, rule profiles and evidence are canonically ordered", () => {
  const projection = run();
  assert.deepEqual(projection.projectionMeta.sourceEngineVersions, [...projection.projectionMeta.sourceEngineVersions].sort());
  assert.deepEqual(projection.projectionMeta.sourceRuleProfiles, [...projection.projectionMeta.sourceRuleProfiles].sort());
  for (const candidate of projection.discovery.candidates) {
    assert.deepEqual(candidate.supportingEvidence.map((item) => item.evidenceId), candidate.supportingEvidence.map((item) => item.evidenceId).sort());
  }
});

test("same identity and canonical bytes deduplicate", () => {
  const input = COCKPIT_PROJECTION_SCENARIOS.CONSTRUCTIVE_MARKET.input;
  const duplicated = buildCockpitProjection({ ...input, alerts: [input.alerts[0], structuredClone(input.alerts[0]), ...input.alerts.slice(1)] });
  assert.equal(duplicated.market.alerts.length, input.alerts.length);
});

test("same identity with different bytes fails closed", () => {
  const input = COCKPIT_PROJECTION_SCENARIOS.CONSTRUCTIVE_MARKET.input;
  const conflicting = structuredClone(input.alerts[0]);
  conflicting.interpretation = `${conflicting.interpretation} changed`;
  assert.throws(() => buildCockpitProjection({ ...input, alerts: [input.alerts[0], conflicting] }), /Conflicting duplicate/);
});

test("numeric equality is not identity and distinct approved IDs remain", () => {
  const first = structuredClone(constructiveMarketSnapshot);
  const second = structuredClone(constructiveMarketSnapshot);
  second.snapshotId = "mock.market.same-values.distinct-id";
  const projection = buildCockpitProjection({ generatedAt: COCKPIT_GENERATED_AT, displayEvidence: { marketSnapshots: [first, second] } });
  assert.equal(projection.displayEvidence.marketSnapshots.length, 2);
});

test("projection declaration is SHADOW validation-only and has no analytical engine or profile", () => {
  assert.deepEqual(COCKPIT_PROJECTION_FEATURE, { moduleId: "cockpit-projection", projectionVersion: "0.5.0", featureLifecycle: FeatureLifecycle.SHADOW, displayMode: CockpitDisplayMode.VALIDATION_ONLY, deterministic: true });
  assert.equal("engineVersion" in COCKPIT_PROJECTION_FEATURE, false);
  assert.equal("ruleProfileId" in COCKPIT_PROJECTION_FEATURE, false);
});

test("feature lifecycle permits validation rendering but cannot influence composite", () => {
  const flags = new FeatureFlagRegistry();
  assert.equal(flags.get("cockpitProjection"), FeatureLifecycle.SHADOW);
  assert.equal(flags.canRender("cockpitProjection"), false);
  assert.equal(flags.canRenderForValidation("cockpitProjection", CockpitDisplayMode.VALIDATION_ONLY), true);
  assert.equal(flags.canInfluenceComposite("cockpitProjection"), false);
});

test("projector preserves approved regime, direction, flow and alert semantics", () => {
  const input = COCKPIT_PROJECTION_SCENARIOS.CONSTRUCTIVE_MARKET.input;
  const projection = buildCockpitProjection(input);
  assert.equal(projection.market.regime.decisionId, input.decisionState.decisionId);
  assert.equal(projection.market.regime.state, input.decisionState.state);
  input.directionAssessments.forEach((item) => assert.ok(projection.market.directions.some((copy) => copy.assessmentId === item.assessmentId && copy.direction === item.direction && copy.score === item.score)));
  input.flowAssessments.forEach((item) => assert.ok([...projection.market.flow, ...projection.market.assetFlow].some((copy) => copy.assessmentId === item.assessmentId && copy.state === item.state && copy.directFlowValue === item.directFlowValue)));
  input.alerts.forEach((item) => assert.ok(projection.market.alerts.some((copy) => copy.alertId === item.alertId && copy.type === item.type)));
});

test("projector rejects unapproved inputs and never mutates source objects", () => {
  const input = COCKPIT_PROJECTION_SCENARIOS.CONSTRUCTIVE_MARKET.input;
  const before = canonicalize(input);
  assert.throws(() => buildCockpitProjection({ ...input, providerPayload: {} }), /Unsupported/);
  run();
  assert.equal(canonicalize(input), before);
});

test("frozen premarket presentation remains explicit and separate", () => {
  const projection = run("PREMARKET_FROZEN");
  const html = renderPremarket(projection);
  assert.match(html, /FINAL PREMARKET SNAPSHOT/);
  assert.match(html, /FROZEN AT OPEN/);
  assert.equal(projection.premarket.snapshot.freezeStatus, "FROZEN");
});

test("mismatched duplicate premarket window identity fails closed", () => {
  const input = structuredClone(COCKPIT_PROJECTION_SCENARIOS.PREMARKET_LIVE.input);
  input.premarketWindowAssessments = structuredClone(input.premarketWindowAssessments);
  input.premarketWindowAssessments[0].state = input.premarketWindowAssessments[0].state === "GREEN" ? "ORANGE" : "GREEN";
  assert.throws(() => buildCockpitProjection(input), /Conflicting duplicate/);
});

test("global horizons and opposing evidence remain visible without relabeling", () => {
  const projection = run("GLOBAL_MIXED_HORIZONS");
  const html = renderGlobalCapital(projection);
  projection.globalCapital.assessments.forEach((item) => assert.match(html, new RegExp(item.horizon)));
  assert.match(html, /Direct, proxy and opposing evidence/);
});

test("DIRECT measured and PROXY inferred asset-flow channels render separately", () => {
  const projection = run("DIRECT_PROXY_CONFLICT");
  const html = renderUsAssetFlows(projection);
  assert.match(html, /DIRECT \/ MEASURED/);
  assert.match(html, /PROXY \/ INFERRED/);
  assert.match(html, /CONFLICT/);
});

test("missing direct flow renders unavailable and proxy never becomes measured amount", () => {
  const projection = run("PROXY_ONLY_FLOW");
  const html = renderUsAssetFlows(projection);
  assert.match(html, /Unavailable|UNAVAILABLE/);
  projection.market.assetFlow.forEach((item) => {
    if (item.flowMode === "PROXY") assert.equal(item.directFlowValue, null);
  });
});

test("approved explicit conflicts and opposing evidence are retained", () => {
  const projection = run("CONFLICT_EVIDENCE_VISIBLE");
  assert.ok(projection.conflicts.length > 0);
  assert.ok(projection.conflicts.some((item) => item.label === "CONFLICT"));
  assert.ok([...projection.market.flow, ...projection.market.assetFlow, projection.market.regime].filter(Boolean).some((item) => item.opposingEvidence?.length));
});

test("freshness display copies approved values and never treats missing as LIVE", () => {
  const projection = run("STALE_MARKET");
  assert.ok(projection.freshnessSummary.some((item) => item.status === FreshnessStatus.STALE));
  projection.freshnessSummary.forEach((item) => {
    const source = projection.sourceObjectIds.includes(item.sourceObjectId);
    assert.equal(source, true);
    assert.equal(item.recordId, freshnessDisplayRecordId(item));
  });
});

test("all freshness display labels render as provided", () => {
  const projection = structuredClone(run());
  const sourceObjectId = projection.sourceObjectIds[0];
  projection.freshnessSummary = ["LIVE", "DELAYED", "DEGRADED", "STALE", "UNAVAILABLE"].map((status) => ({
    recordId: freshnessDisplayRecordId({ sourceObjectId, status, assessedAt: COCKPIT_GENERATED_AT }), sourceObjectId, status,
    assessedAt: COCKPIT_GENERATED_AT, ageSeconds: status === "UNAVAILABLE" ? null : 0,
    decisionGrade: !["STALE", "UNAVAILABLE"].includes(status), reason: `Approved ${status}`,
  })).sort((left, right) => left.recordId < right.recordId ? -1 : 1);
  projection.warnings = [];
  const html = renderCockpitProjection(projection);
  for (const status of ["LIVE", "DELAYED", "DEGRADED", "STALE", "UNAVAILABLE"]) assert.match(JSON.stringify(projection.freshnessSummary), new RegExp(status));
  assert.match(html, /VALIDATION|LIVE MARKET/);
});

test("My Focus stays a placeholder while AI Discovered is separate", () => {
  const html = renderCockpitProjection(run("MULTIPLE_DISCOVERY_CANDIDATES"));
  assert.match(html, /MY FOCUS/);
  assert.match(html, /Analysis engine not yet authorized/);
  assert.match(html, /AI Discovered/);
  assert.doesNotMatch(html, /Stock Decision State/);
});

test("validation UI exposes evidence, source timestamps, versions, profiles and lifecycle", () => {
  const html = renderCockpitProjection(run());
  for (const token of ["supportingEvidence", "opposingEvidence", "sourceMeta", "observedAt", "receivedAt", "engineVersion", "ruleProfileId", "lifecycle", "freshness"]) assert.ok(html.includes(token), `missing ${token}`);
});

test("validation UI contains no analytics, thresholds, provider imports or network calls", async () => {
  const projector = await readFile(path.join(repositoryRoot, "src/decision-cockpit/projection/cockpit-projector.js"), "utf8");
  const renderer = await readFile(path.join(repositoryRoot, "src/decision-cockpit/ui/render-projection.js"), "utf8");
  const shell = await readFile(path.join(repositoryRoot, "src/decision-cockpit/ui/render-shell.js"), "utf8");
  const source = projector + renderer + shell;
  assert.doesNotMatch(source, /\.\.\/adapters\//);
  assert.doesNotMatch(source, /\.\.\/engines\//);
  assert.doesNotMatch(source, /\b(?:fetch|XMLHttpRequest|WebSocket|EventSource)\s*\(/);
  assert.doesNotMatch(source, /\b(?:threshold|weight|probability|targetPrice|positionSize|brokerAction)\b/i);
  assert.doesNotMatch(renderer, /Math\.|localeCompare/);
});

test("rendered UI shows all persistent validation disclosures", async () => {
  const shell = await readFile(path.join(repositoryRoot, "src/decision-cockpit/ui/render-shell.js"), "utf8");
  for (const label of ["VALIDATION MODE", "SHADOW DATA", "NOT LIVE", "NOT PRODUCTION DECISION"]) assert.ok(shell.includes(label));
});

test("projection is deeply immutable and has no composite authority field", () => {
  const projection = run();
  assert.equal(Object.isFrozen(projection), true);
  assert.equal(Object.isFrozen(projection.market.directions), true);
  assert.equal("compositeState" in projection, false);
  assert.throws(() => projection.sourceObjectIds.push("mutation"), TypeError);
});

test("unsupported analytical semantics remain absent from projection", () => {
  const serialized = canonicalize(run());
  for (const field of ["targetPrice", "positionSize", "orderType", "brokerAction", "predictionProbability"]) assert.equal(serialized.includes(`\"${field}\"`), false);
});
