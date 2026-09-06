import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { canonicalize, deterministicSerialize } from "../contracts/serialization.js";
import { discoveryCandidateId } from "../contracts/anomaly-discovery.js";
import { validateContract } from "../contracts/validators.js";
import {
  DirectionState,
  EvidenceType,
  FeatureLifecycle,
  FlowMode,
  FlowState,
  FreshnessStatus,
  SCHEMA_VERSION,
  SessionPhase,
  StockAnalysisOrigin,
  TrafficLight,
} from "../domain/constants.js";
import { evaluateStockDecisions } from "../engines/stock-decision-engine.js";
import { STOCK_DECISION_RULE_PROFILE } from "../engines/rules/profiles.js";
import {
  STOCK_DECISION_EVALUATED_AT,
  STOCK_DECISION_MOCK_NOTICE,
  STOCK_DECISION_SCENARIOS,
  stockCatalystFixture,
  stockDecisionSnapshotFixture,
  stockMarketDecisionFixture,
  stockSectorFixture,
  stockSubjectFixture,
} from "../mocks/stock-decision-scenarios.js";
import { FeatureFlagRegistry } from "../state/feature-flags.js";

const stripMockMetadata = ({ name: _name, notice: _notice, ...input }) => input;
const run = (scenario) => evaluateStockDecisions(stripMockMetadata(scenario));
const decision = (name) => run(STOCK_DECISION_SCENARIOS[name]).decisions[0];
const clone = (value) => structuredClone(value);

function meta({ engineId = "mock.context", engineVersion = "mock.v1", ruleProfileId = "mock.experimental.v1", evaluatedAt = STOCK_DECISION_EVALUATED_AT } = {}) {
  return { engineId, engineVersion, lifecycle: FeatureLifecycle.SHADOW, evaluatedAt, inputSchemaVersions: { Mock: SCHEMA_VERSION }, ruleProfileId, deterministic: true };
}

function source(id, overrides = {}) {
  return {
    schemaVersion: SCHEMA_VERSION, sourceId: `mock.pkg006.test.${id}`, sourceName: STOCK_DECISION_MOCK_NOTICE,
    sourceType: "derived", observedAt: STOCK_DECISION_EVALUATED_AT, receivedAt: STOCK_DECISION_EVALUATED_AT,
    reportingPeriodStart: null, reportingPeriodEnd: null, latencyClass: "realtime", freshnessSeconds: 0,
    isStale: false, qualityScore: 0.9, ...overrides,
  };
}

function evidence(id, field, value, type = EvidenceType.DERIVED, sourceOverrides = {}) {
  return { schemaVersion: SCHEMA_VERSION, evidenceId: `mock.pkg006.test.${id}`, sourceMeta: source(id, sourceOverrides), field, value, unit: null, evidenceType: type };
}

function freshness(status = FreshnessStatus.LIVE) {
  return { schemaVersion: SCHEMA_VERSION, status, assessedAt: STOCK_DECISION_EVALUATED_AT, ageSeconds: status === FreshnessStatus.STALE ? 5000 : 0, reason: STOCK_DECISION_MOCK_NOTICE, decisionGrade: ![FreshnessStatus.STALE, FreshnessStatus.UNAVAILABLE].includes(status) };
}

function confidence(score = 0.8, degradedBy = []) {
  return { schemaVersion: SCHEMA_VERSION, score, reasons: [STOCK_DECISION_MOCK_NOTICE], degradedBy };
}

function directionFixture(horizon, direction, id = horizon) {
  const item = evidence(`direction.${id}`, `direction.${horizon}`, direction);
  return {
    schemaVersion: SCHEMA_VERSION, assessmentId: `mock.pkg006.direction.${id}`, timestamp: STOCK_DECISION_EVALUATED_AT,
    scope: "MARKET", scopeId: "US_MARKET", horizon, direction,
    score: direction === DirectionState.IMPROVING ? 0.5 : direction === DirectionState.DETERIORATING ? -0.5 : direction === DirectionState.UNKNOWN ? null : 0,
    trafficLight: direction === DirectionState.IMPROVING ? TrafficLight.GREEN : direction === DirectionState.DETERIORATING ? TrafficLight.RED : direction === DirectionState.UNKNOWN ? TrafficLight.GREY : TrafficLight.ORANGE,
    confidence: confidence(), supportingEvidence: [item], opposingEvidence: [], freshness: freshness(), engineMeta: meta({ engineId: "market-direction-engine", engineVersion: "0.2-shadow", ruleProfileId: "market-direction.experimental.v0.2" }),
  };
}

function flowFixture({ id = "direct", mode = FlowMode.DIRECT, state = FlowState.DEMAND, direct = true, proxy = false } = {}) {
  const directEvidence = direct ? [evidence(`flow.${id}.direct`, "measuredFlow", 4, EvidenceType.DIRECT)] : [];
  const proxyEvidence = proxy ? [evidence(`flow.${id}.proxy`, "participationProxy", state, EvidenceType.PROXY)] : [];
  return {
    schemaVersion: SCHEMA_VERSION, assessmentId: `mock.pkg006.flow.${id}`, timestamp: STOCK_DECISION_EVALUATED_AT,
    scope: "MARKET", scopeId: "US_MARKET", flowMode: mode, state,
    trafficLight: state === FlowState.DEMAND ? TrafficLight.GREEN : state === FlowState.SELLING_PRESSURE ? TrafficLight.RED : TrafficLight.ORANGE,
    score: state === FlowState.DEMAND ? 0.5 : state === FlowState.SELLING_PRESSURE ? -0.5 : 0,
    directFlowValue: direct ? 4 : null, currency: direct ? "USD" : null, reportingPeriod: direct ? "daily" : null,
    confidence: confidence(), directEvidence, proxyEvidence, opposingEvidence: [], freshness: freshness(),
    engineMeta: meta({ engineId: "money-flow-engine", engineVersion: "0.2-shadow", ruleProfileId: "money-flow.experimental.v0.2" }),
  };
}

test("Package 006 exposes exactly the 24 authorized deterministic MOCK scenarios", () => {
  const required = [
    "ACCUMULATION_CONFIRMED", "BUY_PRESSURE_CONFIRMED", "NEUTRAL_BALANCED", "CONFLICTED_STOCK_VS_MARKET",
    "CONFLICTED_STOCK_VS_SECTOR", "DISTRIBUTION_CONFIRMED", "SELL_PRESSURE_CONFIRMED", "WAIT_EVENT_RISK_EARNINGS",
    "MISSING_RELATIVE_VOLUME", "MISSING_VWAP", "STALE_STOCK_DATA", "STALE_MARKET_CONTEXT",
    "MARKET_RISK_ON_CONFIRMATION", "MARKET_RISK_OFF_CONFLICT", "SECTOR_CONFIRMATION", "SECTOR_DIVERGENCE",
    "RELATIVE_STRENGTH_CONFIRMATION", "RELATIVE_STRENGTH_DIVERGENCE", "VWAP_RECLAIM_CONTEXT", "VWAP_BREAKDOWN_CONTEXT",
    "MY_FOCUS_SUBJECT", "AI_DISCOVERED_SELECTED_SUBJECT", "AI_DISCOVERED_NOT_SELECTED_REJECTION", "DETERMINISTIC_ORDERING",
  ];
  assert.deepEqual(Object.keys(STOCK_DECISION_SCENARIOS), required);
  Object.values(STOCK_DECISION_SCENARIOS).forEach((scenario) => assert.equal(scenario.notice, STOCK_DECISION_MOCK_NOTICE));
});

test("StockAnalysisSubject and StockDecisionContext validate canonically", () => {
  const subject = STOCK_DECISION_SCENARIOS.MY_FOCUS_SUBJECT.subjects[0];
  validateContract("StockAnalysisSubject", subject);
  const output = decision("MY_FOCUS_SUBJECT");
  validateContract("StockDecisionContext", output.stockDecisionContext);
  assert.equal(deterministicSerialize("StockAnalysisSubject", subject), deterministicSerialize("StockAnalysisSubject", clone(subject)));
});

test("StockAnalysisSubject origin constraints fail closed", () => {
  const focus = clone(STOCK_DECISION_SCENARIOS.MY_FOCUS_SUBJECT.subjects[0]);
  focus.discoveryCandidateId = "candidate";
  assert.throws(() => validateContract("StockAnalysisSubject", focus), /discoveryCandidateId=null/);
  const discovered = { ...focus, origin: StockAnalysisOrigin.AI_DISCOVERED_SELECTED, discoveryCandidateId: null };
  assert.throws(() => validateContract("StockAnalysisSubject", discovered), /requires discoveryCandidateId/);
});

test("StockSnapshot additive SessionIdentity accepts complete identity and rejects partial identity", () => {
  const stock = clone(STOCK_DECISION_SCENARIOS.ACCUMULATION_CONFIRMED.stockSnapshots[0]);
  validateContract("StockSnapshot", stock);
  delete stock.sessionIdentity.sessionCalendarId;
  assert.throws(() => validateContract("StockSnapshot", stock), /sessionCalendarId/);
});

test("Package 006 DecisionState additive context is required for its engine", () => {
  const output = clone(decision("ACCUMULATION_CONFIRMED"));
  delete output.stockDecisionContext;
  assert.throws(() => validateContract("DecisionState", output), /requires stockDecisionContext/);
});

test("explicit MY_FOCUS selection is accepted", () => {
  const output = decision("MY_FOCUS_SUBJECT");
  assert.equal(output.stockDecisionContext.origin, StockAnalysisOrigin.MY_FOCUS);
  assert.equal(output.scope, "STOCK");
});

test("explicit AI_DISCOVERED_SELECTED selection with matching provenance is accepted", () => {
  const output = decision("AI_DISCOVERED_SELECTED_SUBJECT");
  assert.equal(output.stockDecisionContext.origin, StockAnalysisOrigin.AI_DISCOVERED_SELECTED);
});

test("an unselected DiscoveryCandidate never triggers analysis or automatic promotion", () => {
  const result = run(STOCK_DECISION_SCENARIOS.AI_DISCOVERED_NOT_SELECTED_REJECTION);
  assert.deepEqual(result.decisions, []);
});

test("missing and mismatched DiscoveryCandidate provenance is rejected", () => {
  const base = stripMockMetadata(STOCK_DECISION_SCENARIOS.AI_DISCOVERED_SELECTED_SUBJECT);
  assert.throws(() => evaluateStockDecisions({ ...base, discoveryCandidates: [] }), /candidate is missing/i);
  const mismatch = clone(base);
  mismatch.subjects[0].symbol = "OTHER";
  assert.throws(() => evaluateStockDecisions(mismatch), /symbol mismatch/);
});

test("future selectedAt is rejected", () => {
  const input = clone(stripMockMetadata(STOCK_DECISION_SCENARIOS.MY_FOCUS_SUBJECT));
  input.subjects[0].selectedAt = "2026-02-03T20:00:01.000Z";
  assert.throws(() => evaluateStockDecisions(input), /Future StockAnalysisSubject/);
});

test("all eight authorized analytical states are emitted with UNKNOWN fail-closed", () => {
  assert.equal(decision("ACCUMULATION_CONFIRMED").state, "ACCUMULATION");
  assert.equal(decision("BUY_PRESSURE_CONFIRMED").state, "BUY_PRESSURE");
  assert.equal(decision("NEUTRAL_BALANCED").state, "NEUTRAL");
  assert.equal(decision("CONFLICTED_STOCK_VS_MARKET").state, "CONFLICTED");
  assert.equal(decision("DISTRIBUTION_CONFIRMED").state, "DISTRIBUTION");
  assert.equal(decision("SELL_PRESSURE_CONFIRMED").state, "SELL_PRESSURE");
  assert.equal(decision("WAIT_EVENT_RISK_EARNINGS").state, "WAIT_EVENT_RISK");
  const unknown = decision("MISSING_VWAP");
  assert.equal(unknown.state, "UNKNOWN");
  assert.equal(unknown.trafficLight, TrafficLight.GREY);
  assert.equal(unknown.score, null);
});

test("multiple independent stock evidence families are required and one metric cannot dominate", () => {
  const missingRvol = decision("MISSING_RELATIVE_VOLUME");
  assert.equal(missingRvol.state, "UNKNOWN");
  const input = clone(stripMockMetadata(STOCK_DECISION_SCENARIOS.ACCUMULATION_CONFIRMED));
  input.stockSnapshots[0].relativeVolume.value = 1;
  input.stockSnapshots[0].distanceFromVWAPPct.value = 0;
  input.stockSnapshots[0].relativeStrengthVsBenchmark.value = 0;
  assert.equal(evaluateStockDecisions(input).decisions[0].state, "NEUTRAL");
});

test("supporting and opposing evidence remain visible in a conflict", () => {
  const output = decision("CONFLICTED_STOCK_VS_MARKET");
  assert.ok(output.supportingEvidence.length > 0);
  assert.ok(output.opposingEvidence.length > 0);
  assert.deepEqual(output.supportingEvidence.map((item) => item.evidenceId), [...output.supportingEvidence.map((item) => item.evidenceId)].sort());
});

test("approved MARKET state is consumed unchanged and is never recalculated", () => {
  const input = stripMockMetadata(STOCK_DECISION_SCENARIOS.CONFLICTED_STOCK_VS_MARKET);
  const before = canonicalize(input.marketDecisionState);
  const output = evaluateStockDecisions(input).decisions[0];
  assert.equal(output.stockDecisionContext.marketDecisionId, input.marketDecisionState.decisionId);
  assert.equal(canonicalize(input.marketDecisionState), before);
});

test("30m/60m/120m/SESSION directions remain ordered and disagreement remains opposing", () => {
  const input = clone(stripMockMetadata(STOCK_DECISION_SCENARIOS.ACCUMULATION_CONFIRMED));
  input.directionAssessments = [
    directionFixture("SESSION", DirectionState.DETERIORATING, "session"),
    directionFixture("30m", DirectionState.IMPROVING, "30"),
    directionFixture("120m", DirectionState.DETERIORATING, "120"),
    directionFixture("60m", DirectionState.IMPROVING, "60"),
  ];
  const output = evaluateStockDecisions(input).decisions[0];
  assert.deepEqual(output.stockDecisionContext.directionAssessmentIds, ["mock.pkg006.direction.30", "mock.pkg006.direction.60", "mock.pkg006.direction.120", "mock.pkg006.direction.session"]);
  assert.equal(output.state, "CONFLICTED");
  assert.ok(output.opposingEvidence.some((item) => item.field.includes("120m") || item.field.includes("SESSION")));
});

test("Sector context supports or opposes but cannot dictate a stock state by itself", () => {
  assert.equal(decision("SECTOR_CONFIRMATION").state, "ACCUMULATION");
  assert.equal(decision("SECTOR_DIVERGENCE").state, "CONFLICTED");
  const input = clone(stripMockMetadata(STOCK_DECISION_SCENARIOS.NEUTRAL_BALANCED));
  input.sectorSnapshots = [stockSectorFixture({ state: TrafficLight.GREEN })];
  assert.equal(evaluateStockDecisions(input).decisions[0].state, "NEUTRAL");
});

test("DIRECT and PROXY flow evidence stay provenance-distinct and never create stock cash flow", () => {
  const input = clone(stripMockMetadata(STOCK_DECISION_SCENARIOS.ACCUMULATION_CONFIRMED));
  input.flowAssessments = [flowFixture({ id: "mixed", mode: FlowMode.MIXED, state: FlowState.DEMAND, direct: true, proxy: true })];
  const output = evaluateStockDecisions(input).decisions[0];
  assert.ok(output.supportingEvidence.some((item) => item.evidenceType === EvidenceType.DIRECT));
  assert.ok(output.supportingEvidence.some((item) => item.evidenceType === EvidenceType.PROXY));
  assert.equal(Object.hasOwn(output, "directFlowValue"), false);
  assert.equal(canonicalize(output).includes("net capital inflow"), false);
});

test("pending HIGH and CRITICAL symbol events trigger WAIT_EVENT_RISK; LOW and unrelated do not", () => {
  assert.equal(decision("WAIT_EVENT_RISK_EARNINGS").state, "WAIT_EVENT_RISK");
  const base = clone(stripMockMetadata(STOCK_DECISION_SCENARIOS.ACCUMULATION_CONFIRMED));
  const symbol = base.subjects[0].symbol;
  base.catalystEvents = [stockCatalystFixture({ id: "critical", symbol, impactTier: "CRITICAL" })];
  assert.equal(evaluateStockDecisions(base).decisions[0].state, "WAIT_EVENT_RISK");
  base.catalystEvents = [stockCatalystFixture({ id: "low", symbol, impactTier: "LOW" })];
  assert.notEqual(evaluateStockDecisions(base).decisions[0].state, "WAIT_EVENT_RISK");
  base.catalystEvents = [stockCatalystFixture({ id: "unrelated", symbol: "OTHER", impactTier: "CRITICAL" })];
  assert.notEqual(evaluateStockDecisions(base).decisions[0].state, "WAIT_EVENT_RISK");
});

test("a known future scheduled event is pending risk, never an occurred factual impact", () => {
  const output = decision("WAIT_EVENT_RISK_EARNINGS");
  assert.ok(output.supportingEvidence.some((item) => item.field.endsWith("scheduledAt")));
  assert.equal(output.supportingEvidence.some((item) => item.field.endsWith("factualImpact")), false);
});

test("stale stock data and unavailable critical evidence fail closed; stale market context degrades", () => {
  const staleStock = decision("STALE_STOCK_DATA");
  assert.equal(staleStock.state, "UNKNOWN");
  assert.equal(staleStock.score, null);
  const staleMarket = decision("STALE_MARKET_CONTEXT");
  assert.ok(staleMarket.confidence.degradedBy.some((item) => item.includes("Market context")));
});

test("future normalized inputs and source timestamps are rejected", () => {
  const cases = [
    ["stockSnapshots", "timestamp"], ["directionAssessments", "timestamp"], ["sectorSnapshots", "timestamp"],
    ["flowAssessments", "timestamp"], ["catalystEvents", "timestamp"], ["discoveryCandidates", "timestamp"],
  ];
  const base = stripMockMetadata(STOCK_DECISION_SCENARIOS.AI_DISCOVERED_SELECTED_SUBJECT);
  const augment = {
    directionAssessments: [directionFixture("30m", DirectionState.IMPROVING)],
    flowAssessments: [flowFixture()],
    catalystEvents: [stockCatalystFixture({ symbol: base.subjects[0].symbol, impactTier: "LOW" })],
  };
  for (const [field, timestampField] of cases) {
    const input = clone({ ...base, ...augment });
    input[field][0][timestampField] = "2026-02-03T20:00:01.000Z";
    if (input[field][0].engineMeta) input[field][0].engineMeta.evaluatedAt = "2026-02-03T20:00:01.000Z";
    if (field === "discoveryCandidates") input[field][0].candidateId = discoveryCandidateId({ engineVersion: input[field][0].engineMeta.engineVersion, ruleProfileId: input[field][0].engineMeta.ruleProfileId, timestamp: input[field][0].timestamp, symbol: input[field][0].symbol });
    assert.throws(() => evaluateStockDecisions(input), /Future data/);
  }
  const marketFuture = clone(stripMockMetadata(STOCK_DECISION_SCENARIOS.ACCUMULATION_CONFIRMED));
  marketFuture.marketDecisionState.timestamp = "2026-02-03T20:00:01.000Z";
  assert.throws(() => evaluateStockDecisions(marketFuture), /Future data/);
});

test("future source observedAt and receivedAt are rejected", () => {
  for (const field of ["observedAt", "receivedAt"]) {
    const input = clone(stripMockMetadata(STOCK_DECISION_SCENARIOS.ACCUMULATION_CONFIRMED));
    input.stockSnapshots[0].evidenceRefs[0].sourceMeta[field] = "2026-02-03T20:00:01.000Z";
    assert.throws(() => evaluateStockDecisions(input), /Future source/);
  }
});

test("historical StockSnapshot comparison is past-only and exact same-session", () => {
  const input = clone(stripMockMetadata(STOCK_DECISION_SCENARIOS.ACCUMULATION_CONFIRMED));
  const prior = clone(input.stockSnapshots[0]);
  prior.snapshotId = "mock.pkg006.stock.prior";
  prior.timestamp = "2026-02-03T19:30:00.000Z";
  input.stockSnapshots.unshift(prior);
  const output = evaluateStockDecisions(input).decisions[0];
  assert.ok(output.stockDecisionContext.sourceSnapshotIds.includes(prior.snapshotId));
  const crossSession = clone(input);
  crossSession.stockSnapshots[0].sessionIdentity.sessionDate = "2026-02-02";
  assert.throws(() => evaluateStockDecisions(crossSession), /Cross-session/);
  const missingIdentity = clone(input);
  delete missingIdentity.stockSnapshots[0].sessionIdentity;
  assert.throws(() => evaluateStockDecisions(missingIdentity), /missing-identity/);
});

test("future, equal-time, and conflicting duplicate historical identities fail closed without interpolation", () => {
  const base = clone(stripMockMetadata(STOCK_DECISION_SCENARIOS.ACCUMULATION_CONFIRMED));
  const equal = clone(base.stockSnapshots[0]);
  equal.snapshotId = "mock.pkg006.stock.equal-time";
  base.stockSnapshots.push(equal);
  assert.throws(() => evaluateStockDecisions(base), /strictly earlier/);
  const conflict = clone(stripMockMetadata(STOCK_DECISION_SCENARIOS.ACCUMULATION_CONFIRMED));
  const duplicate = clone(conflict.stockSnapshots[0]);
  duplicate.changePct.value = 99;
  conflict.stockSnapshots.push(duplicate);
  assert.throws(() => evaluateStockDecisions(conflict), /Conflicting duplicate StockSnapshot/);
});

test("same subject ID deduplicates identical bytes and rejects conflicting bytes", () => {
  const input = clone(stripMockMetadata(STOCK_DECISION_SCENARIOS.ACCUMULATION_CONFIRMED));
  input.subjects.push(clone(input.subjects[0]));
  assert.equal(evaluateStockDecisions(input).decisions.length, 1);
  input.subjects[1].symbol = "OTHER";
  assert.throws(() => evaluateStockDecisions(input), /Conflicting duplicate StockAnalysisSubject/);
});

test("same semantic input and reordered arrays produce identical IDs and canonical bytes", () => {
  const scenario = stripMockMetadata(STOCK_DECISION_SCENARIOS.DETERMINISTIC_ORDERING);
  const first = evaluateStockDecisions(scenario);
  const reordered = evaluateStockDecisions({ ...scenario, subjects: [...scenario.subjects].reverse(), stockSnapshots: [...scenario.stockSnapshots].reverse(), sectorSnapshots: [...scenario.sectorSnapshots].reverse() });
  assert.equal(canonicalize(first), canonicalize(reordered));
  assert.deepEqual(first.decisions.map((item) => item.scopeId), ["AAA", "ZZZ"]);
  assert.deepEqual(first.decisions.map((item) => item.decisionId), reordered.decisions.map((item) => item.decisionId));
});

test("Package 006 outputs are SHADOW and cannot influence production composite state", () => {
  const output = decision("ACCUMULATION_CONFIRMED");
  assert.equal(output.engineMeta.lifecycle, FeatureLifecycle.SHADOW);
  assert.equal(output.stockDecisionContext.engineMeta.lifecycle, FeatureLifecycle.SHADOW);
  const flags = new FeatureFlagRegistry();
  assert.equal(flags.get("stockDecisionEngine"), FeatureLifecycle.SHADOW);
  assert.equal(flags.canInfluenceComposite("stockDecisionEngine"), false);
});

test("rule profile identity and calibration disclosures are exact", () => {
  assert.equal(STOCK_DECISION_RULE_PROFILE.engineId, "stock-decision-engine");
  assert.equal(STOCK_DECISION_RULE_PROFILE.engineVersion, "0.6-shadow");
  assert.equal(STOCK_DECISION_RULE_PROFILE.ruleProfileId, "stock-decision.experimental.v0.6");
  assert.equal(STOCK_DECISION_RULE_PROFILE.version, "0.6.0");
  assert.match(STOCK_DECISION_RULE_PROFILE.description, /SYNTHETIC/);
  assert.match(STOCK_DECISION_RULE_PROFILE.description, /NOT PRODUCTION-CALIBRATED/);
  assert.match(STOCK_DECISION_RULE_PROFILE.description, /NOT EMPIRICALLY VALIDATED/);
});

test("forbidden trade, prediction, options, provider and UI semantics are absent", async () => {
  const output = canonicalize(decision("ACCUMULATION_CONFIRMED"));
  for (const field of ["targetPrice", "entryPrice", "exitPrice", "stopLoss", "positionSize", "orderType", "brokerAction", "tradeDecisionZone", "predictionRecord"]) {
    assert.equal(output.includes(`\"${field}\"`), false);
  }
  const engineSource = await readFile(new URL("../engines/stock-decision-engine.js", import.meta.url), "utf8");
  assert.equal(/adapters\//.test(engineSource), false);
  assert.equal(/\bfetch\s*\(|XMLHttpRequest|WebSocket/.test(engineSource), false);
  assert.equal(/OptionsSnapshot|implied.?volatility|dealer.?position/i.test(engineSource), false);
  assert.equal(/TradeDecisionZone/.test(engineSource), false);
});

test("unauthorized analytical inputs are rejected rather than silently expanding scope", () => {
  const input = stripMockMetadata(STOCK_DECISION_SCENARIOS.ACCUMULATION_CONFIRMED);
  assert.throws(() => evaluateStockDecisions({ ...input, optionsData: [] }), /Unauthorized Package 006 input/);
  assert.throws(() => evaluateStockDecisions({ ...input, providerPayload: {} }), /Unauthorized Package 006 input/);
});
