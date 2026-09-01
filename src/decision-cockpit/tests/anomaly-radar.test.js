import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { canonicalize, deserializeContract, deterministicSerialize } from "../contracts/serialization.js";
import { validateContract } from "../contracts/validators.js";
import { AnomalyType, EvidenceType, FeatureLifecycle, FreshnessStatus } from "../domain/constants.js";
import { evaluateAnomalyRadar } from "../engines/anomaly-radar-engine.js";
import { ANOMALY_RADAR_RULE_PROFILE } from "../engines/rules/profiles.js";
import {
  ANOMALY_EVALUATED_AT,
  ANOMALY_MOCK_DATA_NOTICE,
  ANOMALY_RADAR_SCENARIOS,
  anomalyCatalystFixture,
  anomalySectorFixture,
  anomalyStockFixture,
} from "../mocks/anomaly-radar-scenarios.js";
import { mockEvidence, mockSource } from "../mocks/fixtures.js";
import { FeatureFlagRegistry } from "../state/feature-flags.js";

const run = (scenario) => evaluateAnomalyRadar(scenario);
const candidateFor = (scenario) => run(scenario).discoveryCandidates[0];
const includes = (scenario, anomalyType) => candidateFor(scenario)?.anomalyTypes.includes(anomalyType) ?? false;

test("Package 003 exposes all 22 required deterministic MOCK scenarios", () => {
  const required = [
    "RVOL_SPIKE", "ABNORMAL_DOLLAR_VOLUME", "GAP_UP_CONFIRMED", "GAP_DOWN_CONFIRMED", "VWAP_RECLAIM",
    "VWAP_BREAKDOWN", "BREAKOUT_CONFIRMED", "BREAKDOWN_CONFIRMED", "RELATIVE_STRENGTH_ACCELERATION",
    "RELATIVE_STRENGTH_DETERIORATION", "PRICE_VOLUME_DIVERGENCE", "SECTOR_CONFIRMATION", "SECTOR_DIVERGENCE",
    "CATALYST_ASSOCIATED_MOVE", "ABNORMAL_MOVE_WITHOUT_CATALYST", "STALE_STOCK_DATA", "MISSING_VOLUME",
    "MISSING_SECTOR_CONTEXT", "FUTURE_SNAPSHOT_REJECTION", "MULTIPLE_ANOMALIES_SAME_SYMBOL",
    "DUPLICATE_ALERT_PREVENTION", "DETERMINISTIC_ORDERING",
  ];
  assert.deepEqual(Object.keys(ANOMALY_RADAR_SCENARIOS), required);
  for (const scenario of Object.values(ANOMALY_RADAR_SCENARIOS)) assert.equal(scenario.notice, ANOMALY_MOCK_DATA_NOTICE);
});

test("same normalized input produces byte-identical canonical output", () => {
  const scenario = ANOMALY_RADAR_SCENARIOS.MULTIPLE_ANOMALIES_SAME_SYMBOL;
  assert.equal(canonicalize(run(scenario)), canonicalize(run(scenario)));
});

test("reordered normalized input arrays produce byte-identical canonical output", () => {
  const scenario = ANOMALY_RADAR_SCENARIOS.DETERMINISTIC_ORDERING;
  const reversed = { ...scenario, stockSnapshots: [...scenario.stockSnapshots].reverse() };
  assert.equal(canonicalize(run(scenario)), canonicalize(run(reversed)));
});

test("candidate, Alert, anomaly, evidence, catalyst and snapshot ordering is canonical", () => {
  const ordering = run(ANOMALY_RADAR_SCENARIOS.DETERMINISTIC_ORDERING);
  assert.deepEqual(ordering.discoveryCandidates.map((item) => item.symbol), ["AAA", "ZZZ"]);
  assert.deepEqual(ordering.alerts.map((item) => item.symbol), ["AAA", "ZZZ"]);
  const candidate = candidateFor(ANOMALY_RADAR_SCENARIOS.MULTIPLE_ANOMALIES_SAME_SYMBOL);
  assert.deepEqual(candidate.anomalyTypes, [
    AnomalyType.RELATIVE_VOLUME_SPIKE,
    AnomalyType.ABNORMAL_DOLLAR_VOLUME,
    AnomalyType.GAP_UP,
    AnomalyType.VWAP_RECLAIM,
    AnomalyType.BREAKOUT,
    AnomalyType.RELATIVE_STRENGTH_ACCELERATION,
    AnomalyType.SECTOR_DIVERGENCE,
    AnomalyType.CATALYST_ASSOCIATED_ANOMALY,
  ]);
  for (const field of ["supportingEvidence", "opposingEvidence"]) {
    const ids = candidate[field].map((item) => item.evidenceId);
    assert.deepEqual(ids, [...ids].sort());
  }
  assert.deepEqual(candidate.catalystEventIds, [...candidate.catalystEventIds].sort());
  assert.deepEqual(candidate.sourceSnapshotIds, [...candidate.sourceSnapshotIds].sort());
});

test("future StockSnapshot is rejected", () => {
  assert.throws(() => run(ANOMALY_RADAR_SCENARIOS.FUTURE_SNAPSHOT_REJECTION), /Future data is forbidden/);
});

test("future SectorSnapshot is rejected", () => {
  const stock = anomalyStockFixture({ id: "future-sector-stock", symbol: "FSEC", relativeVolume: 3, changePct: 1 });
  const sector = anomalySectorFixture({ id: "future-sector", timestamp: "2026-01-15T15:01:00.000Z" });
  assert.throws(() => evaluateAnomalyRadar({ stockSnapshots: [stock], sectorSnapshots: [sector], catalystEvents: [], evaluatedAt: ANOMALY_EVALUATED_AT }), /Future data is forbidden/);
});

test("future CatalystEvent fact is rejected", () => {
  const stock = anomalyStockFixture({ id: "future-catalyst-stock", symbol: "FCAT", relativeVolume: 3 });
  const event = anomalyCatalystFixture({ id: "future-catalyst", symbol: "FCAT", timestamp: "2026-01-15T15:01:00.000Z" });
  assert.throws(() => evaluateAnomalyRadar({ stockSnapshots: [stock], sectorSnapshots: [], catalystEvents: [event], evaluatedAt: ANOMALY_EVALUATED_AT }), /Future data is forbidden/);
});

test("future historical reference is rejected and never used", () => {
  const current = anomalyStockFixture({ id: "reference-current", symbol: "REF", relativeVolume: 3 });
  const futureReference = anomalyStockFixture({ id: "reference-future", symbol: "REF", timestamp: "2026-01-15T15:02:00.000Z", dayHigh: 90 });
  assert.throws(() => evaluateAnomalyRadar({ stockSnapshots: [current, futureReference], sectorSnapshots: [], catalystEvents: [], evaluatedAt: ANOMALY_EVALUATED_AT }), /Future data is forbidden/);
});

test("future source receipt is rejected", () => {
  const stock = anomalyStockFixture({ id: "future-receipt", symbol: "FRECV", relativeVolume: 3, sourceOverrides: { receivedAt: "2026-01-15T15:01:00.000Z" } });
  assert.throws(() => evaluateAnomalyRadar({ stockSnapshots: [stock], sectorSnapshots: [], catalystEvents: [], evaluatedAt: ANOMALY_EVALUATED_AT }), /Future source receipt/);
});

test("future scheduled catalyst remains known risk and cannot support an occurred anomaly", () => {
  const stock = anomalyStockFixture({ id: "scheduled-stock", symbol: "SCHED", relativeVolume: 3 });
  const event = anomalyCatalystFixture({ id: "scheduled-event", symbol: "SCHED", timestamp: "2026-01-15T14:58:00.000Z", scheduled: true, scheduledAt: "2026-01-15T15:30:00.000Z" });
  const result = evaluateAnomalyRadar({ stockSnapshots: [stock], sectorSnapshots: [], catalystEvents: [event], evaluatedAt: ANOMALY_EVALUATED_AT });
  assert.equal(result.discoveryCandidates[0].anomalyTypes.includes(AnomalyType.CATALYST_ASSOCIATED_ANOMALY), false);
  assert.deepEqual(result.discoveryCandidates[0].catalystEventIds, []);
});

test("stale StockSnapshot fails closed without Candidate or Alert", () => {
  const result = run(ANOMALY_RADAR_SCENARIOS.STALE_STOCK_DATA);
  assert.deepEqual(result.discoveryCandidates, []);
  assert.deepEqual(result.alerts, []);
});

test("stale stock evidence provenance cannot trigger an anomaly", () => {
  const stock = anomalyStockFixture({ id: "stale-evidence", symbol: "STE", relativeVolume: 3, sourceOverrides: { isStale: true } });
  const result = evaluateAnomalyRadar({ stockSnapshots: [stock], sectorSnapshots: [], catalystEvents: [], evaluatedAt: ANOMALY_EVALUATED_AT });
  assert.deepEqual(result.discoveryCandidates, []);
});

test("stale sector context cannot create false confirmation", () => {
  const stock = anomalyStockFixture({ id: "stale-sector-stock", symbol: "SSEC", relativeVolume: 3, changePct: 1 });
  const sector = anomalySectorFixture({ id: "stale-sector", priceChangePct: 1, stale: true });
  const result = evaluateAnomalyRadar({ stockSnapshots: [stock], sectorSnapshots: [sector], catalystEvents: [], evaluatedAt: ANOMALY_EVALUATED_AT });
  const candidate = result.discoveryCandidates[0];
  assert.equal(candidate.anomalyTypes.includes(AnomalyType.SECTOR_CONFIRMATION), false);
  assert.equal(candidate.sectorId, null);
  assert.ok(candidate.confidence.degradedBy.some((reason) => reason.includes("stale")));
});

test("missing critical volume evidence fails the affected anomalies closed", () => {
  const result = run(ANOMALY_RADAR_SCENARIOS.MISSING_VOLUME);
  assert.deepEqual(result.discoveryCandidates, []);
  assert.deepEqual(result.alerts, []);
});

test("missing sector context stays explicit and does not become confirmation", () => {
  const candidate = candidateFor(ANOMALY_RADAR_SCENARIOS.MISSING_SECTOR_CONTEXT);
  assert.equal(candidate.sectorId, null);
  assert.equal(candidate.anomalyTypes.includes(AnomalyType.SECTOR_CONFIRMATION), false);
  assert.ok(candidate.confidence.degradedBy.includes("Matching sector context is missing."));
});

test("relative-volume spike is detected without bullish semantics", () => {
  assert.equal(includes(ANOMALY_RADAR_SCENARIOS.RVOL_SPIKE, AnomalyType.RELATIVE_VOLUME_SPIKE), true);
});

test("abnormal dollar volume is detected without flow semantics", () => {
  assert.equal(includes(ANOMALY_RADAR_SCENARIOS.ABNORMAL_DOLLAR_VOLUME, AnomalyType.ABNORMAL_DOLLAR_VOLUME), true);
});

test("gap up and gap down remain explicit observed anomaly classes", () => {
  assert.equal(includes(ANOMALY_RADAR_SCENARIOS.GAP_UP_CONFIRMED, AnomalyType.GAP_UP), true);
  assert.equal(includes(ANOMALY_RADAR_SCENARIOS.GAP_DOWN_CONFIRMED, AnomalyType.GAP_DOWN), true);
});

test("VWAP reclaim and breakdown require past-only prior relationships", () => {
  assert.equal(includes(ANOMALY_RADAR_SCENARIOS.VWAP_RECLAIM, AnomalyType.VWAP_RECLAIM), true);
  assert.equal(includes(ANOMALY_RADAR_SCENARIOS.VWAP_BREAKDOWN, AnomalyType.VWAP_BREAKDOWN), true);
  const currentOnly = ANOMALY_RADAR_SCENARIOS.VWAP_RECLAIM.stockSnapshots.at(-1);
  const result = evaluateAnomalyRadar({ stockSnapshots: [currentOnly], sectorSnapshots: [], catalystEvents: [], evaluatedAt: ANOMALY_EVALUATED_AT });
  assert.equal(result.discoveryCandidates.some((item) => item.anomalyTypes.includes(AnomalyType.VWAP_RECLAIM)), false);
});

test("breakout and breakdown use past-only reference snapshots", () => {
  assert.equal(includes(ANOMALY_RADAR_SCENARIOS.BREAKOUT_CONFIRMED, AnomalyType.BREAKOUT), true);
  assert.equal(includes(ANOMALY_RADAR_SCENARIOS.BREAKDOWN_CONFIRMED, AnomalyType.BREAKDOWN), true);
});

test("relative-strength acceleration and deterioration use comparable past observations", () => {
  assert.equal(includes(ANOMALY_RADAR_SCENARIOS.RELATIVE_STRENGTH_ACCELERATION, AnomalyType.RELATIVE_STRENGTH_ACCELERATION), true);
  assert.equal(includes(ANOMALY_RADAR_SCENARIOS.RELATIVE_STRENGTH_DETERIORATION, AnomalyType.RELATIVE_STRENGTH_DETERIORATION), true);
});

test("price-volume divergence preserves separate supporting and opposing families", () => {
  const candidate = candidateFor(ANOMALY_RADAR_SCENARIOS.PRICE_VOLUME_DIVERGENCE);
  assert.ok(candidate.anomalyTypes.includes(AnomalyType.PRICE_VOLUME_DIVERGENCE));
  assert.ok(candidate.supportingEvidence.some((item) => item.field.startsWith("relativeVolume")));
  assert.ok(candidate.opposingEvidence.some((item) => item.field.startsWith("changePct")));
});

test("sector confirmation is explicit normalized context", () => {
  const candidate = candidateFor(ANOMALY_RADAR_SCENARIOS.SECTOR_CONFIRMATION);
  assert.ok(candidate.anomalyTypes.includes(AnomalyType.SECTOR_CONFIRMATION));
  assert.equal(candidate.sectorId, "TECHNOLOGY");
});

test("sector divergence preserves opposition and reduces confidence", () => {
  const candidate = candidateFor(ANOMALY_RADAR_SCENARIOS.SECTOR_DIVERGENCE);
  assert.ok(candidate.anomalyTypes.includes(AnomalyType.SECTOR_DIVERGENCE));
  assert.ok(candidate.opposingEvidence.some((item) => item.field.startsWith("priceChangePct")));
  assert.ok(candidate.confidence.degradedBy.some((reason) => reason.includes("conflict")));
});

test("eligible catalyst association preserves event ID without claiming causation", () => {
  const candidate = candidateFor(ANOMALY_RADAR_SCENARIOS.CATALYST_ASSOCIATED_MOVE);
  assert.ok(candidate.anomalyTypes.includes(AnomalyType.CATALYST_ASSOCIATED_ANOMALY));
  assert.equal(candidate.catalystEventIds.length, 1);
  const alert = run(ANOMALY_RADAR_SCENARIOS.CATALYST_ASSOCIATED_MOVE).alerts.find((item) => item.type === AnomalyType.CATALYST_ASSOCIATED_ANOMALY);
  assert.match(alert.interpretation, /causation is not asserted/);
});

test("no-catalyst input does not fabricate catalyst certainty", () => {
  const candidate = candidateFor(ANOMALY_RADAR_SCENARIOS.ABNORMAL_MOVE_WITHOUT_CATALYST);
  assert.equal(candidate.anomalyTypes.includes(AnomalyType.CATALYST_ASSOCIATED_ANOMALY), false);
  assert.deepEqual(candidate.catalystEventIds, []);
  assert.ok(candidate.confidence.degradedBy.some((reason) => reason.includes("not proof")));
});

test("multiple simultaneous anomalies produce one Candidate and preserve all anomaly types", () => {
  const result = run(ANOMALY_RADAR_SCENARIOS.MULTIPLE_ANOMALIES_SAME_SYMBOL);
  assert.equal(result.discoveryCandidates.length, 1);
  assert.ok(result.discoveryCandidates[0].anomalyTypes.length >= 8);
});

test("duplicate StockSnapshot provenance cannot duplicate Alerts or Candidates", () => {
  const result = run(ANOMALY_RADAR_SCENARIOS.DUPLICATE_ALERT_PREVENTION);
  assert.equal(result.discoveryCandidates.length, 1);
  assert.equal(result.alerts.length, 1);
  assert.equal(new Set(result.alerts.map((item) => item.alertId)).size, result.alerts.length);
});

test("distinct equal-valued evidence is preserved by provenance identity", () => {
  const source = mockSource({ sourceId: "mock.anomaly.equal-value", sourceName: ANOMALY_MOCK_DATA_NOTICE, observedAt: ANOMALY_EVALUATED_AT, receivedAt: ANOMALY_EVALUATED_AT });
  const extra = mockEvidence({ id: "mock.anomaly.equal-value.relativeVolume", field: "relativeVolume.value", value: 3, unit: "ratio", type: EvidenceType.DIRECT, source });
  const stock = anomalyStockFixture({ id: "equal-value", symbol: "EQUAL", relativeVolume: 3, changePct: 0.8, extraEvidence: [extra] });
  const candidate = evaluateAnomalyRadar({ stockSnapshots: [stock], sectorSnapshots: [], catalystEvents: [], evaluatedAt: ANOMALY_EVALUATED_AT }).discoveryCandidates[0];
  assert.equal(candidate.supportingEvidence.filter((item) => item.field === "relativeVolume.value").length, 2);
});

test("conflicting duplicate snapshot identities fail closed deterministically", () => {
  const first = anomalyStockFixture({ id: "conflicting-id", symbol: "CID", relativeVolume: 3 });
  const second = structuredClone(first);
  second.relativeVolume.value = 4;
  assert.throws(() => evaluateAnomalyRadar({ stockSnapshots: [first, second], sectorSnapshots: [], catalystEvents: [], evaluatedAt: ANOMALY_EVALUATED_AT }), /Conflicting duplicate StockSnapshot identity/);
});

test("DiscoveryCandidate validates and round-trips canonically", () => {
  const candidate = candidateFor(ANOMALY_RADAR_SCENARIOS.MULTIPLE_ANOMALIES_SAME_SYMBOL);
  validateContract("DiscoveryCandidate", candidate);
  const serialized = deterministicSerialize("DiscoveryCandidate", candidate);
  assert.equal(deterministicSerialize("DiscoveryCandidate", deserializeContract("DiscoveryCandidate", serialized)), serialized);
});

test("DiscoveryCandidate validator rejects noncanonical anomaly order and deterministic identity drift", () => {
  const candidate = structuredClone(candidateFor(ANOMALY_RADAR_SCENARIOS.MULTIPLE_ANOMALIES_SAME_SYMBOL));
  candidate.anomalyTypes.reverse();
  assert.throws(() => validateContract("DiscoveryCandidate", candidate), /canonically ordered/);
  const identityDrift = structuredClone(candidateFor(ANOMALY_RADAR_SCENARIOS.RVOL_SPIKE));
  identityDrift.candidateId = "random-id";
  assert.throws(() => validateContract("DiscoveryCandidate", identityDrift), /deterministic identity tuple/);
});

test("Package 003 output has no forbidden command fields or BUY/SELL states", () => {
  const result = run(ANOMALY_RADAR_SCENARIOS.MULTIPLE_ANOMALIES_SAME_SYMBOL);
  const serializedOutput = canonicalize(result);
  for (const field of ["targetPrice", "positionSize", "orderType", "brokerAction"]) assert.equal(serializedOutput.includes(`\"${field}\"`), false);
  for (const state of ["\"BUY\"", "\"SELL\"", "\"STRONG_BUY\"", "\"STRONG_SELL\""]) assert.equal(serializedOutput.includes(state), false);
});

test("AnomalyRadar rule profile is versioned, described, EXPERIMENTAL and SHADOW", () => {
  assert.equal(ANOMALY_RADAR_RULE_PROFILE.ruleProfileId, "anomaly-radar.experimental.v0.3");
  assert.equal(ANOMALY_RADAR_RULE_PROFILE.version, "0.3.0");
  assert.ok(ANOMALY_RADAR_RULE_PROFILE.description.length > 20);
  assert.equal(ANOMALY_RADAR_RULE_PROFILE.status, "EXPERIMENTAL");
  assert.equal(ANOMALY_RADAR_RULE_PROFILE.lifecycle, FeatureLifecycle.SHADOW);
  assert.equal(ANOMALY_RADAR_RULE_PROFILE.engineVersion, "0.3-shadow");
});

test("AnomalyRadar, EngineMeta and DiscoveryCandidate remain SHADOW and non-composite", () => {
  const registry = new FeatureFlagRegistry();
  const result = run(ANOMALY_RADAR_SCENARIOS.RVOL_SPIKE);
  assert.equal(registry.get("anomalyRadar"), FeatureLifecycle.SHADOW);
  assert.equal(registry.canCompute("anomalyRadar"), true);
  assert.equal(registry.canRender("anomalyRadar"), false);
  assert.equal(registry.canInfluenceComposite("anomalyRadar"), false);
  assert.equal(result.engineMeta.lifecycle, FeatureLifecycle.SHADOW);
  assert.equal(result.discoveryCandidates.every((item) => item.engineMeta.lifecycle === FeatureLifecycle.SHADOW), true);
  assert.equal(Object.values(registry.snapshot()).includes(FeatureLifecycle.ACTIVE), false);
});

test("AI Discovered output remains structurally separate from My Focus", () => {
  const result = run(ANOMALY_RADAR_SCENARIOS.RVOL_SPIKE);
  assert.ok(Array.isArray(result.discoveryCandidates));
  assert.equal("myFocus" in result, false);
  assert.equal("focusStocks" in result, false);
  assert.equal("promotion" in result, false);
});

test("engine imports no adapters/providers and contains no network access", async () => {
  const source = await readFile(new URL("../engines/anomaly-radar-engine.js", import.meta.url), "utf8");
  assert.doesNotMatch(source, /adapters\//);
  assert.doesNotMatch(source, /\b(?:fetch|XMLHttpRequest|WebSocket)\s*\(/);
  assert.doesNotMatch(source, /https?:\/\//i);
  assert.doesNotMatch(source, /providerPayload|vendorPayload|rawProviderPayload/);
});

test("UI contains no Package 003 analytical engine import or calculation", async () => {
  const source = await readFile(new URL("../ui/render-shell.js", import.meta.url), "utf8");
  assert.doesNotMatch(source, /anomaly-radar-engine|evaluateAnomalyRadar|DiscoveryCandidate/);
});
