import test from "node:test";
import assert from "node:assert/strict";
import { canonicalize, deterministicSerialize } from "../contracts/serialization.js";
import { validateContract } from "../contracts/validators.js";
import { DirectionState, FeatureLifecycle, FlowState, TrafficLight } from "../domain/constants.js";
import { evaluateGlobalCapitalRotation } from "../engines/global-capital-rotation-engine.js";
import { evaluateMarketDirection } from "../engines/market-direction-engine.js";
import { evaluateMarketRegime } from "../engines/market-regime-engine.js";
import { evaluateSectorMoneyFlow } from "../engines/money-flow-engine.js";
import { assembleMarketContextBundle } from "../engines/market-context-bundle.js";
import { evaluateUSAssetFlows } from "../engines/us-asset-flow-monitor.js";
import { RULE_PROFILES } from "../engines/rules/profiles.js";
import { MARKET_CONTEXT_SCENARIOS, MOCK_DATA_NOTICE } from "../mocks/market-context-scenarios.js";
import { FeatureFlagRegistry } from "../state/feature-flags.js";
import { HistoricalSnapshotWindow, HistoricalWindowResult } from "../state/historical-snapshot-window.js";

function runScenario(scenario) {
  const currentMarket = scenario.marketSnapshots.at(-1);
  const currentBreadth = scenario.breadthSnapshots.at(-1);
  const currentSectors = scenario.sectorSnapshots.filter((item) => item.timestamp === scenario.evaluatedAt);
  const historicalWindow = new HistoricalSnapshotWindow();
  scenario.marketSnapshots.forEach((item) => historicalWindow.append("MarketSnapshot", "US_MARKET", item));
  scenario.breadthSnapshots.forEach((item) => historicalWindow.append("BreadthSnapshot", item.venue, item));
  scenario.sectorSnapshots.forEach((item) => historicalWindow.append("SectorSnapshot", item.sectorId, item));
  const assetFlows = evaluateUSAssetFlows({ assetFlowSnapshots: scenario.assetFlowSnapshots, evaluatedAt: scenario.evaluatedAt });
  const sectorFlows = evaluateSectorMoneyFlow({ sectorSnapshots: currentSectors, assetFlowSnapshots: scenario.assetFlowSnapshots, evaluatedAt: scenario.evaluatedAt });
  const globalRotation = evaluateGlobalCapitalRotation({ countryFlowSnapshots: scenario.countryFlowSnapshots, evaluatedAt: scenario.evaluatedAt });
  const marketRegime = evaluateMarketRegime({ marketSnapshot: currentMarket, breadthSnapshot: currentBreadth, sectorSnapshots: currentSectors, assetFlowSnapshots: scenario.assetFlowSnapshots, assetFlowAssessments: assetFlows, globalRotationAssessments: globalRotation, evaluatedAt: scenario.evaluatedAt });
  const direction = evaluateMarketDirection({ marketSnapshot: currentMarket, breadthSnapshot: currentBreadth, sectorSnapshots: currentSectors, historicalWindow, evaluatedAt: scenario.evaluatedAt, sessionStartTimestamp: scenario.sessionStartTimestamp });
  const sourceSnapshotIds = [scenario.marketSnapshots, scenario.breadthSnapshots, scenario.sectorSnapshots, scenario.assetFlowSnapshots, scenario.countryFlowSnapshots].flat().map((item) => item.snapshotId);
  const bundle = assembleMarketContextBundle({ marketDecisionState: marketRegime, directionAssessments: direction, sectorFlowAssessments: sectorFlows, assetFlowAssessments: assetFlows, globalRotationAssessments: globalRotation, sourceSnapshotIds, evaluatedAt: scenario.evaluatedAt });
  return { currentMarket, currentBreadth, currentSectors, historicalWindow, assetFlows, sectorFlows, globalRotation, marketRegime, direction, bundle };
}

test("all 12 required scenarios are explicitly MOCK / NOT LIVE", () => {
  assert.deepEqual(Object.keys(MARKET_CONTEXT_SCENARIOS).sort(), ["BREADTH_RECOVERY", "BROAD_RISK_OFF", "BROAD_RISK_ON", "DIRECT_PROXY_CONFLICT", "GLOBAL_US_DISAGREEMENT", "INSUFFICIENT_COUNTRY_DATA", "LATE_SESSION_DETERIORATION", "MEGACAP_CONCENTRATED", "MISSING_HISTORY", "PRICE_VOLUME_DIVERGENCE", "STALE_DATA", "STRUCTURAL_VS_OVERNIGHT"].sort());
  Object.values(MARKET_CONTEXT_SCENARIOS).forEach((scenario) => assert.equal(scenario.notice, MOCK_DATA_NOTICE));
});

test("rule profiles are versioned, described, EXPERIMENTAL and SHADOW", () => {
  assert.equal(RULE_PROFILES.length, 7);
  RULE_PROFILES.forEach((profile) => {
    assert.match(profile.version, /^0\.[23]\.0$/);
    assert.ok(profile.description.length > 20);
    assert.equal(profile.status, "EXPERIMENTAL");
    assert.equal(profile.lifecycle, FeatureLifecycle.SHADOW);
  });
});

test("same normalized input, timestamp and profile produce canonical identical output", () => {
  const first = runScenario(MARKET_CONTEXT_SCENARIOS.BROAD_RISK_ON);
  const second = runScenario(MARKET_CONTEXT_SCENARIOS.BROAD_RISK_ON);
  assert.equal(canonicalize(first.bundle), canonicalize(second.bundle));
  assert.equal(deterministicSerialize("MarketContextBundle", first.bundle), deterministicSerialize("MarketContextBundle", second.bundle));
  for (const [contractName, left, right] of [
    ["EngineMeta", first.marketRegime.engineMeta, second.marketRegime.engineMeta],
    ["DirectionAssessment", first.direction[0], second.direction[0]],
    ["FlowAssessment", first.assetFlows[0], second.assetFlows[0]],
    ["GlobalRotationAssessment", first.globalRotation[0], second.globalRotation[0]],
  ]) assert.equal(deterministicSerialize(contractName, left), deterministicSerialize(contractName, right));
});

test("HistoricalSnapshotWindow is deterministic, past-only and rejects out-of-order append", () => {
  const scenario = MARKET_CONTEXT_SCENARIOS.BROAD_RISK_ON;
  const window = new HistoricalSnapshotWindow();
  scenario.marketSnapshots.forEach((item) => window.append("MarketSnapshot", "US_MARKET", item));
  assert.equal(window.latestAtOrBefore("MarketSnapshot", "US_MARKET", "2026-02-03T19:00:00.000Z").timestamp, "2026-02-03T19:00:00.000Z");
  assert.throws(() => window.append("MarketSnapshot", "US_MARKET", scenario.marketSnapshots[0]), /Duplicate|Out-of-order/);
  assert.throws(() => evaluateMarketRegime({ marketSnapshot: scenario.marketSnapshots.at(-1), breadthSnapshot: scenario.breadthSnapshots.at(-1), evaluatedAt: "2026-02-03T19:59:59.000Z" }), /Future data/);
});

test("session boundaries are preserved and no interpolation occurs", () => {
  const source = MARKET_CONTEXT_SCENARIOS.BROAD_RISK_ON.marketSnapshots;
  const prior = structuredClone(source[3]);
  prior.snapshotId = "mock.pkg002.other-session";
  prior.sessionDate = "2026-02-02";
  prior.sessionIdentity.sessionDate = "2026-02-02";
  const window = new HistoricalSnapshotWindow({ outOfOrderPolicy: "SORT" });
  window.append("MarketSnapshot", "US_MARKET", prior).append("MarketSnapshot", "US_MARKET", source.at(-1));
  const result = window.comparisonFor("MarketSnapshot", "US_MARKET", source.at(-1), { minutes: 30, toleranceSeconds: 600 });
  assert.equal(result.status, HistoricalWindowResult.INSUFFICIENT);
  const noInterpolation = new HistoricalSnapshotWindow({ outOfOrderPolicy: "SORT" });
  noInterpolation.append("MarketSnapshot", "US_MARKET", source[0]).append("MarketSnapshot", "US_MARKET", source.at(-1));
  assert.equal(noInterpolation.comparisonFor("MarketSnapshot", "US_MARKET", source.at(-1), { minutes: 30, toleranceSeconds: 60 }).status, HistoricalWindowResult.MISSING);
});

test("direction horizons are independent and missing history returns UNKNOWN/GREY", () => {
  const recovery = runScenario(MARKET_CONTEXT_SCENARIOS.BREADTH_RECOVERY).direction;
  assert.deepEqual(recovery.map((item) => item.horizon), ["30m", "60m", "120m", "SESSION"]);
  assert.equal(recovery[0].direction, DirectionState.IMPROVING);
  assert.equal(recovery.at(-1).direction, DirectionState.DETERIORATING);
  const missing = runScenario(MARKET_CONTEXT_SCENARIOS.MISSING_HISTORY).direction;
  assert.equal(missing.every((item) => item.direction === DirectionState.UNKNOWN && item.trafficLight === TrafficLight.GREY && item.score === null), true);
});

test("broad regimes and concentrated index/breadth conflict resolve explainably", () => {
  assert.equal(runScenario(MARKET_CONTEXT_SCENARIOS.BROAD_RISK_ON).marketRegime.state, "RISK_ON");
  assert.equal(runScenario(MARKET_CONTEXT_SCENARIOS.BROAD_RISK_OFF).marketRegime.state, "RISK_OFF");
  assert.equal(runScenario(MARKET_CONTEXT_SCENARIOS.MEGACAP_CONCENTRATED).marketRegime.state, "CONFLICTED");
});

test("breadth monotonicity holds when all other market inputs are unchanged", () => {
  const scenario = MARKET_CONTEXT_SCENARIOS.BROAD_RISK_ON;
  const baseline = runScenario(scenario);
  const weakBreadth = structuredClone(baseline.currentBreadth);
  weakBreadth.snapshotId = "mock.pkg002.monotonic.weak-breadth";
  weakBreadth.advancers.value = 900; weakBreadth.decliners.value = 2200;
  weakBreadth.advancingVolume.value = 0.8; weakBreadth.decliningVolume.value = 2.4;
  weakBreadth.newHighs.value = 30; weakBreadth.newLows.value = 180;
  const weaker = evaluateMarketRegime({ marketSnapshot: baseline.currentMarket, breadthSnapshot: weakBreadth, sectorSnapshots: baseline.currentSectors, assetFlowAssessments: baseline.assetFlows, globalRotationAssessments: baseline.globalRotation, evaluatedAt: scenario.evaluatedAt });
  assert.ok(weaker.score <= baseline.marketRegime.score);
  assert.ok(weaker.confidence.score <= baseline.marketRegime.confidence.score);
});

test("price-volume divergence does not become sector demand", () => {
  const result = runScenario(MARKET_CONTEXT_SCENARIOS.PRICE_VOLUME_DIVERGENCE);
  assert.equal(result.sectorFlows.every((item) => item.state !== FlowState.DEMAND), true);
  assert.equal(result.marketRegime.state, "CONFLICTED");
});

test("direct positive and proxy negative US equity evidence remains MIXED and separate", () => {
  const result = runScenario(MARKET_CONTEXT_SCENARIOS.DIRECT_PROXY_CONFLICT);
  const equity = result.assetFlows.find((item) => item.scopeId === "US_EQUITY");
  assert.equal(equity.state, FlowState.MIXED);
  assert.ok(equity.directFlowValue > 0);
  assert.ok(equity.directEvidence.every((item) => item.evidenceType === "DIRECT"));
  assert.ok(equity.proxyEvidence.every((item) => item.evidenceType !== "DIRECT"));
  assert.ok(result.bundle.conflicts.some((item) => item.includes("US_EQUITY")));
});

test("PROXY output cannot fabricate a dollar flow", () => {
  const result = runScenario(MARKET_CONTEXT_SCENARIOS.BROAD_RISK_ON);
  result.sectorFlows.forEach((item) => {
    assert.equal(item.flowMode, "PROXY");
    assert.equal(item.directFlowValue, null);
    assert.equal(item.currency, null);
  });
  const invalid = structuredClone(result.sectorFlows[0]);
  invalid.directFlowValue = 10;
  assert.throws(() => validateContract("FlowAssessment", invalid), /PROXY mode requires directFlowValue=null/);
});

test("stale direct flow cannot masquerade as live numeric flow", () => {
  const base = MARKET_CONTEXT_SCENARIOS.BROAD_RISK_ON.assetFlowSnapshots.find((item) => item.assetClass === "US_EQUITY");
  const stale = structuredClone(base);
  stale.sourceMeta.isStale = true;
  stale.evidenceRefs[0].sourceMeta.isStale = true;
  const assessment = evaluateUSAssetFlows({ assetFlowSnapshots: [stale], evaluatedAt: MARKET_CONTEXT_SCENARIOS.BROAD_RISK_ON.evaluatedAt }).find((item) => item.scopeId === "US_EQUITY");
  assert.equal(assessment.state, FlowState.INSUFFICIENT);
  assert.equal(assessment.trafficLight, TrafficLight.GREY);
  assert.equal(assessment.directFlowValue, null);
});

test("stale critical market evidence fails closed", () => {
  const result = runScenario(MARKET_CONTEXT_SCENARIOS.STALE_DATA);
  assert.equal(result.marketRegime.state, "UNKNOWN");
  assert.equal(result.marketRegime.trafficLight, TrafficLight.GREY);
  assert.equal(result.direction.every((item) => item.direction === DirectionState.UNKNOWN), true);
});

test("global horizons preserve frequency boundaries and missing country inputs fail closed", () => {
  const structuralConflict = runScenario(MARKET_CONTEXT_SCENARIOS.STRUCTURAL_VS_OVERNIGHT).globalRotation[0];
  assert.equal(structuralConflict.horizon, "overnight");
  assert.equal(structuralConflict.directFlowValue, null);
  assert.equal(structuralConflict.state, "NEGATIVE_ROTATION");
  assert.ok(structuralConflict.confidence.degradedBy.some((item) => item.includes("horizon/frequency")));
  const insufficient = runScenario(MARKET_CONTEXT_SCENARIOS.INSUFFICIENT_COUNTRY_DATA).globalRotation[0];
  assert.equal(insufficient.state, "INSUFFICIENT");
  assert.equal(insufficient.trafficLight, TrafficLight.GREY);
});

test("global constructive rotation and weak US internals are both preserved", () => {
  const result = runScenario(MARKET_CONTEXT_SCENARIOS.GLOBAL_US_DISAGREEMENT);
  assert.equal(result.globalRotation.find((item) => item.countryOrRegion === "United States").state, "POSITIVE_ROTATION");
  assert.equal(result.assetFlows.find((item) => item.scopeId === "US_EQUITY").state, FlowState.SELLING_PRESSURE);
  assert.ok(result.bundle.conflicts.includes("GLOBAL_US_VS_US_EQUITY_FLOW_DISAGREEMENT"));
});

test("bundle is immutable, non-authoritative and preserves versions/source IDs", () => {
  const result = runScenario(MARKET_CONTEXT_SCENARIOS.BROAD_RISK_ON);
  assert.equal(Object.isFrozen(result.bundle), true);
  assert.equal(Object.isFrozen(result.bundle.directionAssessments), true);
  assert.ok(result.bundle.sourceSnapshotIds.length > 12);
  assert.equal(result.bundle.generatedBy.every((meta) => meta.lifecycle === FeatureLifecycle.SHADOW), true);
  assert.equal("compositeScore" in result.bundle, false);
  assert.throws(() => result.bundle.conflicts.push("mutation"), TypeError);
});

test("all Package 002 flags default SHADOW and cannot influence production composite", () => {
  const registry = new FeatureFlagRegistry();
  for (const name of ["marketRegimeEngine", "marketDirectionEngine", "moneyFlowEngine", "usAssetFlowMonitor", "globalCapitalRotation"]) {
    assert.equal(registry.get(name), FeatureLifecycle.SHADOW);
    assert.equal(registry.canInfluenceComposite(name), false);
    assert.equal(registry.canRender(name), false);
  }
  assert.equal(Object.values(registry.snapshot()).includes(FeatureLifecycle.ACTIVE), false);
});
