import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { canonicalize, deserializeContract, deterministicSerialize } from "../contracts/serialization.js";
import { validateContract } from "../contracts/validators.js";
import {
  CatalystImpactTier,
  FeatureLifecycle,
  FreshnessStatus,
  GlobalRotationState,
  LiquidityQuality,
  ParticipationProxyState,
  PremarketFreezeStatus,
  PremarketWindow,
  SessionPhase,
  TrafficLight,
} from "../domain/constants.js";
import { classifyPremarketWindow, evaluatePremarketIntelligence } from "../engines/premarket-intelligence-engine.js";
import { PREMARKET_INTELLIGENCE_RULE_PROFILE, RULE_PROFILES } from "../engines/rules/profiles.js";
import {
  PREMARKET_CALENDAR_ID,
  PREMARKET_EVALUATED_AT,
  PREMARKET_INTELLIGENCE_SCENARIOS,
  PREMARKET_MOCK_DATA_NOTICE,
  PREMARKET_REGULAR_OPEN,
  premarketBoundaryFixture,
  premarketCatalystFixture,
  premarketDiscoveryFixture,
  premarketFuturesFixture,
  premarketGlobalFixture,
  premarketMarketFixture,
  premarketSectorFixture,
  premarketStockFixture,
} from "../mocks/premarket-intelligence-scenarios.js";
import { FeatureFlagRegistry } from "../state/feature-flags.js";
import { PremarketSnapshotStore } from "../state/premarket-snapshot-store.js";

const run = (scenario) => evaluatePremarketIntelligence(scenario);
const windowOf = (output, window) => output.windowAssessments.find((item) => item.window === window);
const cloneScenario = (scenario, overrides = {}) => ({ ...structuredClone(scenario), ...overrides });

test("Package 004 exposes all 23 required deterministic MOCK scenarios", () => {
  const required = [
    "ALL_CONSTRUCTIVE", "MIXED_FUTURES", "BROAD_RISK_OFF", "AFTERHOURS_ONLY", "OVERNIGHT_DETERIORATION",
    "PREMARKET_RECOVERY", "OVERNIGHT_TO_PREMARKET_REVERSAL", "WINDOW_SEPARATION", "FUTURE_INPUT_REJECTION",
    "REGULAR_SESSION_INPUT_REJECTION", "STALE_FUTURES", "STALE_MARKET_CONTEXT", "THIN_PREMARKET_LIQUIDITY",
    "BROAD_PARTICIPATION", "CONCENTRATED_PARTICIPATION", "HIGH_IMPACT_EVENT_PENDING", "HIGH_IMPACT_EVENT_RELEASED",
    "GLOBAL_US_DISAGREEMENT", "FOCUS_STOCK_RISK", "AI_DISCOVERED_PREMARKET", "FREEZE_AT_OPEN",
    "POST_OPEN_MUTATION_REJECTION", "DETERMINISTIC_ORDERING",
  ];
  assert.deepEqual(Object.keys(PREMARKET_INTELLIGENCE_SCENARIOS), required);
  Object.values(PREMARKET_INTELLIGENCE_SCENARIOS).forEach((scenario) => assert.equal(scenario.notice, PREMARKET_MOCK_DATA_NOTICE));
});

test("MarketSessionBoundary validates and round-trips canonically", () => {
  const boundary = premarketBoundaryFixture();
  validateContract("MarketSessionBoundary", boundary);
  const serialized = deterministicSerialize("MarketSessionBoundary", boundary);
  assert.equal(deterministicSerialize("MarketSessionBoundary", deserializeContract("MarketSessionBoundary", serialized)), serialized);
});

test("MarketSessionBoundary rejects invalid timestamp ordering", () => {
  const invalid = structuredClone(premarketBoundaryFixture());
  invalid.afterhoursEndTimestamp = invalid.priorRegularCloseTimestamp;
  assert.throws(() => validateContract("MarketSessionBoundary", invalid), /session timestamps must satisfy/);
});

test("MarketSessionBoundary requires all four explicit timestamps and provenance", () => {
  const missingTimestamp = structuredClone(premarketBoundaryFixture());
  delete missingTimestamp.regularOpenTimestamp;
  assert.throws(() => validateContract("MarketSessionBoundary", missingTimestamp), /regularOpenTimestamp/);
  const missingEvidence = structuredClone(premarketBoundaryFixture());
  missingEvidence.evidenceRefs = [];
  assert.throws(() => validateContract("MarketSessionBoundary", missingEvidence), /non-empty/);
});

test("FuturesSnapshot validates explicit measurements, freshness, provenance and session identity", () => {
  const snapshot = premarketFuturesFixture({ id: "contract" });
  validateContract("FuturesSnapshot", snapshot);
  assert.equal(deterministicSerialize("FuturesSnapshot", snapshot), deterministicSerialize("FuturesSnapshot", deserializeContract("FuturesSnapshot", deterministicSerialize("FuturesSnapshot", snapshot))));
});

test("FuturesSnapshot preserves explicit null measurement and rejects missingReason omission", () => {
  const snapshot = premarketFuturesFixture({ id: "missing", missingChange: true });
  validateContract("FuturesSnapshot", snapshot);
  assert.equal(snapshot.changePctFromPriorCashClose.value, null);
  const invalid = structuredClone(snapshot);
  invalid.changePctFromPriorCashClose.missingReason = null;
  assert.throws(() => validateContract("FuturesSnapshot", invalid), /missingReason/);
});

test("FuturesSnapshot rejects incompatible price units", () => {
  const invalid = structuredClone(premarketFuturesFixture({ id: "units" }));
  invalid.priorCashClose.unit = "USD";
  assert.throws(() => validateContract("FuturesSnapshot", invalid), /compatible units/);
});

test("PremarketStockSnapshot validates liquidity, missingness and canonical event IDs", () => {
  const snapshot = premarketStockFixture({ id: "contract", catalystEventIds: ["event.a", "event.b"] });
  validateContract("PremarketStockSnapshot", snapshot);
  const missing = premarketStockFixture({ id: "missing-rvol", relativeVolume: null });
  validateContract("PremarketStockSnapshot", missing);
  assert.equal(missing.relativePremarketVolume.value, null);
});

test("PremarketStockSnapshot rejects non-premarket identity and noncanonical catalyst IDs", () => {
  const phase = structuredClone(premarketStockFixture({ id: "wrong-phase" }));
  phase.sessionIdentity.sessionPhase = SessionPhase.OVERNIGHT;
  assert.throws(() => validateContract("PremarketStockSnapshot", phase), /sessionPhase must be premarket/);
  const events = structuredClone(premarketStockFixture({ id: "events", catalystEventIds: ["event.a", "event.b"] }));
  events.catalystEventIds.reverse();
  assert.throws(() => validateContract("PremarketStockSnapshot", events), /canonically ordered/);
});

test("PremarketWindowAssessment validates canonical identity and SHADOW metadata", () => {
  const assessment = windowOf(run(PREMARKET_INTELLIGENCE_SCENARIOS.ALL_CONSTRUCTIVE), PremarketWindow.PREMARKET);
  validateContract("PremarketWindowAssessment", assessment);
  const invalid = structuredClone(assessment);
  invalid.assessmentId = "random";
  assert.throws(() => validateContract("PremarketWindowAssessment", invalid), /deterministic identity/);
});

test("extended PremarketSnapshot validates and legacy PremarketSnapshot compatibility remains additive", async () => {
  const output = run(PREMARKET_INTELLIGENCE_SCENARIOS.ALL_CONSTRUCTIVE);
  validateContract("PremarketSnapshot", output);
  const fixtures = await import("../mocks/fixtures.js");
  validateContract("PremarketSnapshot", fixtures.premarketSnapshot);
});

test("PremarketSnapshot extension rejects partial extension and invalid freeze combinations", () => {
  const output = run(PREMARKET_INTELLIGENCE_SCENARIOS.ALL_CONSTRUCTIVE);
  const partial = structuredClone(output);
  delete partial.windowAssessments;
  assert.throws(() => validateContract("PremarketSnapshot", partial), /windowAssessments/);
  const invalidLive = structuredClone(output);
  invalidLive.frozenAt = invalidLive.regularOpenTimestamp;
  assert.throws(() => validateContract("PremarketSnapshot", invalidLive), /LIVE PremarketSnapshot requires frozenAt=null/);
});

test("CatalystEvent accepts valid optional impactTier and rejects invalid values", () => {
  validateContract("CatalystEvent", premarketCatalystFixture({ id: "impact", impactTier: CatalystImpactTier.CRITICAL }));
  const invalid = structuredClone(premarketCatalystFixture({ id: "impact-invalid" }));
  invalid.impactTier = "EXTREME";
  assert.throws(() => validateContract("CatalystEvent", invalid), /impactTier/);
});

test("explicit boundaries classify afterhours, overnight and premarket with exact half-open intervals", () => {
  const boundary = premarketBoundaryFixture();
  assert.equal(classifyPremarketWindow(boundary.priorRegularCloseTimestamp, boundary), PremarketWindow.AFTERHOURS);
  assert.equal(classifyPremarketWindow(boundary.afterhoursEndTimestamp, boundary), PremarketWindow.OVERNIGHT);
  assert.equal(classifyPremarketWindow(boundary.premarketStartTimestamp, boundary), PremarketWindow.PREMARKET);
  assert.equal(classifyPremarketWindow(boundary.regularOpenTimestamp, boundary), null);
});

test("custom explicit open is honored without a hard-coded 09:30 assumption", () => {
  const boundary = premarketBoundaryFixture({ regularOpenTimestamp: "2026-01-15T14:00:00.000Z" });
  const snapshot = premarketFuturesFixture({ id: "custom-open", timestamp: "2026-01-15T13:55:00.000Z" });
  const output = evaluatePremarketIntelligence({ marketSessionBoundary: boundary, futuresSnapshots: [snapshot], evaluatedAt: "2026-01-15T14:00:00.000Z" });
  assert.equal(output.frozenAt, "2026-01-15T14:00:00.000Z");
});

test("sessionDate mismatch fails closed", () => {
  const input = premarketFuturesFixture({ id: "date-mismatch", sessionOverrides: { sessionDate: "2026-01-14" } });
  assert.throws(() => evaluatePremarketIntelligence({ marketSessionBoundary: premarketBoundaryFixture(), futuresSnapshots: [input], evaluatedAt: PREMARKET_EVALUATED_AT }), /Session date mismatch/);
});

test("sessionCalendarId mismatch fails closed", () => {
  const input = premarketFuturesFixture({ id: "calendar-mismatch", sessionOverrides: { sessionCalendarId: "wrong.calendar" } });
  assert.throws(() => evaluatePremarketIntelligence({ marketSessionBoundary: premarketBoundaryFixture(), futuresSnapshots: [input], evaluatedAt: PREMARKET_EVALUATED_AT }), /Session calendar mismatch/);
});

test("session phase contradiction fails closed", () => {
  const input = premarketFuturesFixture({ id: "phase-mismatch", sessionOverrides: { sessionPhase: SessionPhase.OVERNIGHT } });
  assert.throws(() => evaluatePremarketIntelligence({ marketSessionBoundary: premarketBoundaryFixture(), futuresSnapshots: [input], evaluatedAt: PREMARKET_EVALUATED_AT }), /Session phase contradicts/);
});

test("regular-session MarketSnapshot is rejected from premarket evidence", () => {
  assert.throws(() => run(PREMARKET_INTELLIGENCE_SCENARIOS.REGULAR_SESSION_INPUT_REJECTION), /Regular-session evidence is forbidden/);
});

test("missing SessionIdentity fails closed", () => {
  const input = structuredClone(premarketSectorFixture({ id: "missing-identity" }));
  delete input.sessionIdentity;
  assert.throws(() => evaluatePremarketIntelligence({ marketSessionBoundary: premarketBoundaryFixture(), sectorSnapshots: [input], evaluatedAt: PREMARKET_EVALUATED_AT }), /sessionIdentity|SessionIdentity/);
});

test("future FuturesSnapshot is rejected", () => {
  assert.throws(() => run(PREMARKET_INTELLIGENCE_SCENARIOS.FUTURE_INPUT_REJECTION), /Future data is forbidden/);
});

test("future MarketSnapshot is rejected", () => {
  const input = premarketMarketFixture({ id: "future", timestamp: "2026-01-15T14:26:00.000Z" });
  assert.throws(() => evaluatePremarketIntelligence({ marketSessionBoundary: premarketBoundaryFixture(), marketSnapshots: [input], evaluatedAt: PREMARKET_EVALUATED_AT }), /Future data is forbidden/);
});

test("future PremarketStockSnapshot is rejected", () => {
  const input = premarketStockFixture({ id: "future", timestamp: "2026-01-15T14:26:00.000Z" });
  assert.throws(() => evaluatePremarketIntelligence({ marketSessionBoundary: premarketBoundaryFixture(), premarketStockSnapshots: [input], evaluatedAt: PREMARKET_EVALUATED_AT }), /Future data is forbidden/);
});

test("future SectorSnapshot is rejected", () => {
  const input = premarketSectorFixture({ id: "future", timestamp: "2026-01-15T14:26:00.000Z" });
  assert.throws(() => evaluatePremarketIntelligence({ marketSessionBoundary: premarketBoundaryFixture(), sectorSnapshots: [input], evaluatedAt: PREMARKET_EVALUATED_AT }), /Future data is forbidden/);
});

test("future CatalystEvent fact is rejected", () => {
  const input = premarketCatalystFixture({ id: "future", timestamp: "2026-01-15T14:26:00.000Z", scheduled: false, scheduledAt: null });
  assert.throws(() => evaluatePremarketIntelligence({ marketSessionBoundary: premarketBoundaryFixture(), catalystEvents: [input], evaluatedAt: PREMARKET_EVALUATED_AT }), /Future data is forbidden/);
});

test("future source observation is rejected", () => {
  const input = premarketFuturesFixture({ id: "future-observed", sourceOverrides: { observedAt: "2026-01-15T14:26:00.000Z" } });
  assert.throws(() => evaluatePremarketIntelligence({ marketSessionBoundary: premarketBoundaryFixture(), futuresSnapshots: [input], evaluatedAt: PREMARKET_EVALUATED_AT }), /Future source observation/);
});

test("future source receipt is rejected", () => {
  const input = premarketFuturesFixture({ id: "future-received", sourceOverrides: { receivedAt: "2026-01-15T14:26:00.000Z" } });
  assert.throws(() => evaluatePremarketIntelligence({ marketSessionBoundary: premarketBoundaryFixture(), futuresSnapshots: [input], evaluatedAt: PREMARKET_EVALUATED_AT }), /Future source receipt/);
});

test("future GlobalRotationAssessment reference is rejected", () => {
  const input = premarketGlobalFixture({ id: "future", timestamp: "2026-01-15T14:26:00.000Z" });
  assert.throws(() => evaluatePremarketIntelligence({ marketSessionBoundary: premarketBoundaryFixture(), globalRotationAssessments: [input], evaluatedAt: PREMARKET_EVALUATED_AT }), /Future data is forbidden/);
});

test("future DiscoveryCandidate reference is rejected", () => {
  const input = premarketDiscoveryFixture({ id: "future", timestamp: "2026-01-15T14:26:00.000Z" });
  assert.throws(() => evaluatePremarketIntelligence({ marketSessionBoundary: premarketBoundaryFixture(), discoveryCandidates: [input], evaluatedAt: PREMARKET_EVALUATED_AT }), /Future data is forbidden/);
});

test("provider payload fields are rejected at the normalized engine boundary", () => {
  const input = structuredClone(premarketFuturesFixture({ id: "provider-payload" }));
  input.providerPayload = { forbidden: true };
  assert.throws(() => evaluatePremarketIntelligence({ marketSessionBoundary: premarketBoundaryFixture(), futuresSnapshots: [input], evaluatedAt: PREMARKET_EVALUATED_AT }), /Provider payload fields are forbidden/);
});

test("afterhours, overnight and premarket remain independent assessments", () => {
  const output = run(PREMARKET_INTELLIGENCE_SCENARIOS.WINDOW_SEPARATION);
  assert.deepEqual(output.windowAssessments.map((item) => item.window), [PremarketWindow.AFTERHOURS, PremarketWindow.OVERNIGHT, PremarketWindow.PREMARKET]);
  assert.deepEqual(output.windowAssessments.map((item) => item.state), [TrafficLight.GREEN, TrafficLight.RED, TrafficLight.ORANGE]);
});

test("overnight deterioration and premarket recovery preserve reversal", () => {
  const output = run(PREMARKET_INTELLIGENCE_SCENARIOS.OVERNIGHT_TO_PREMARKET_REVERSAL);
  assert.equal(windowOf(output, PremarketWindow.OVERNIGHT).direction, "DETERIORATING");
  assert.equal(windowOf(output, PremarketWindow.PREMARKET).direction, "IMPROVING");
  assert.equal(output.compositeState, TrafficLight.ORANGE);
});

test("afterhours-only evidence does not populate future windows", () => {
  const output = run(PREMARKET_INTELLIGENCE_SCENARIOS.AFTERHOURS_ONLY);
  assert.equal(windowOf(output, PremarketWindow.AFTERHOURS).state, TrafficLight.GREEN);
  assert.equal(windowOf(output, PremarketWindow.OVERNIGHT).state, TrafficLight.GREY);
  assert.equal(windowOf(output, PremarketWindow.PREMARKET).state, TrafficLight.GREY);
});

test("aligned ES, NQ and RTY remain constructive", () => {
  const output = run(PREMARKET_INTELLIGENCE_SCENARIOS.ALL_CONSTRUCTIVE);
  assert.equal(output.futuresState, TrafficLight.GREEN);
  assert.equal(windowOf(output, PremarketWindow.PREMARKET).state, TrafficLight.GREEN);
});

test("conflicting ES, NQ and RTY preserve explicit opposition", () => {
  const output = run(PREMARKET_INTELLIGENCE_SCENARIOS.MIXED_FUTURES);
  const assessment = windowOf(output, PremarketWindow.PREMARKET);
  assert.equal(output.futuresState, TrafficLight.ORANGE);
  assert.equal(assessment.state, TrafficLight.ORANGE);
  assert.ok(assessment.opposingEvidence.some((item) => item.field.includes("futures.RTY")));
});

test("missing futures components degrade confidence and are not zero", () => {
  const scenario = cloneScenario(PREMARKET_INTELLIGENCE_SCENARIOS.MIXED_FUTURES, {
    futuresSnapshots: [premarketFuturesFixture({ id: "only-es", instrument: "ES" })],
  });
  const assessment = windowOf(run(scenario), PremarketWindow.PREMARKET);
  assert.ok(assessment.confidence.degradedBy.some((reason) => reason.includes("NQ, RTY")));
});

test("stale futures fail closed instead of creating false alignment", () => {
  const output = run(PREMARKET_INTELLIGENCE_SCENARIOS.STALE_FUTURES);
  assert.equal(output.futuresState, TrafficLight.GREY);
  assert.equal(windowOf(output, PremarketWindow.PREMARKET).state, TrafficLight.GREY);
});

test("stale market context fails closed", () => {
  const output = run(PREMARKET_INTELLIGENCE_SCENARIOS.STALE_MARKET_CONTEXT);
  assert.equal(windowOf(output, PremarketWindow.PREMARKET).state, TrafficLight.GREY);
  assert.equal(output.freshness.decisionGrade, false);
});

test("broad participation emits only a broad-demand proxy", () => {
  const output = run(PREMARKET_INTELLIGENCE_SCENARIOS.BROAD_PARTICIPATION);
  assert.equal(output.participationState, TrafficLight.GREEN);
  assert.ok(output.supportingEvidence.some((item) => item.field === "participationProxyState" && item.value === ParticipationProxyState.BROAD_DEMAND_PROXY));
});

test("concentrated participation remains ORANGE rather than broad", () => {
  const output = run(PREMARKET_INTELLIGENCE_SCENARIOS.CONCENTRATED_PARTICIPATION);
  assert.equal(output.participationState, TrafficLight.ORANGE);
  assert.ok(output.supportingEvidence.some((item) => item.value === ParticipationProxyState.CONCENTRATED_DEMAND));
});

test("insufficient participation remains GREY and missing is not neutral", () => {
  const output = run(PREMARKET_INTELLIGENCE_SCENARIOS.THIN_PREMARKET_LIQUIDITY);
  assert.equal(output.participationState, TrafficLight.GREY);
  assert.ok(output.confidence.degradedBy.some((reason) => reason.includes("LOW")));
});

test("participation proxy never fabricates direct cash flow", () => {
  const serialized = canonicalize(run(PREMARKET_INTELLIGENCE_SCENARIOS.BROAD_PARTICIPATION));
  assert.equal(serialized.includes("directFlowValue"), false);
  assert.equal(serialized.includes("entered equities"), false);
  assert.ok(JSON.parse(serialized).evidenceRefs.every((item) => item.field !== "directFlowValue"));
});

test("LOW liquidity caps confidence below high-confidence output", () => {
  const output = run(PREMARKET_INTELLIGENCE_SCENARIOS.THIN_PREMARKET_LIQUIDITY);
  assert.ok(windowOf(output, PremarketWindow.PREMARKET).confidence.score <= 0.69);
  assert.ok(output.confidence.score <= 0.69);
});

test("INSUFFICIENT liquidity cannot emit high-confidence directional output", () => {
  const scenario = cloneScenario(PREMARKET_INTELLIGENCE_SCENARIOS.THIN_PREMARKET_LIQUIDITY, {
    premarketStockSnapshots: [premarketStockFixture({ id: "insufficient", liquidityQuality: LiquidityQuality.INSUFFICIENT, gapPct: 8 })],
  });
  const output = run(scenario);
  assert.ok(output.confidence.score <= 0.49);
  assert.ok(windowOf(output, PremarketWindow.PREMARKET).confidence.score <= 0.49);
});

test("pending HIGH-impact event before open degrades confidence", () => {
  const pending = run(PREMARKET_INTELLIGENCE_SCENARIOS.HIGH_IMPACT_EVENT_PENDING);
  const baselineScenario = cloneScenario(PREMARKET_INTELLIGENCE_SCENARIOS.HIGH_IMPACT_EVENT_PENDING, { catalystEvents: [] });
  const baseline = run(baselineScenario);
  assert.ok(pending.confidence.score < baseline.confidence.score);
  assert.equal(pending.macroRiskState, TrafficLight.ORANGE);
  assert.ok(pending.opposingEvidence.some((item) => item.field.includes("pending-risk")));
});

test("pending CRITICAL event is explicit risk and not an occurred fact", () => {
  const event = premarketCatalystFixture({ id: "pending-critical", impactTier: CatalystImpactTier.CRITICAL });
  const scenario = cloneScenario(PREMARKET_INTELLIGENCE_SCENARIOS.HIGH_IMPACT_EVENT_PENDING, { catalystEvents: [event] });
  const output = run(scenario);
  assert.equal(output.macroRiskState, TrafficLight.RED);
  assert.ok(output.opposingEvidence.some((item) => item.value === CatalystImpactTier.CRITICAL));
  assert.equal(output.supportingEvidence.some((item) => item.field.includes("released")), false);
});

test("released eligible catalyst contributes without converting a pending event", () => {
  const output = run(PREMARKET_INTELLIGENCE_SCENARIOS.HIGH_IMPACT_EVENT_RELEASED);
  assert.deepEqual(output.scheduledEventIds, []);
  assert.ok(windowOf(output, PremarketWindow.PREMARKET).supportingEvidence.some((item) => item.field.includes("released")));
});

test("unknown catalyst remains GREY rather than proof of no catalyst", () => {
  const output = run(PREMARKET_INTELLIGENCE_SCENARIOS.ALL_CONSTRUCTIVE);
  assert.equal(output.macroRiskState, TrafficLight.GREY);
  assert.deepEqual(output.scheduledEventIds, []);
});

test("overnight and 1d global context are accepted", () => {
  const overnight = run(PREMARKET_INTELLIGENCE_SCENARIOS.ALL_CONSTRUCTIVE);
  assert.equal(overnight.globalMarketState, TrafficLight.GREEN);
  const oneDayScenario = cloneScenario(PREMARKET_INTELLIGENCE_SCENARIOS.ALL_CONSTRUCTIVE, { globalRotationAssessments: [premarketGlobalFixture({ id: "one-day", horizon: "1d" })] });
  assert.equal(run(oneDayScenario).globalMarketState, TrafficLight.GREEN);
});

test("structural global context is never relabeled as overnight flow", () => {
  const scenario = cloneScenario(PREMARKET_INTELLIGENCE_SCENARIOS.ALL_CONSTRUCTIVE, {
    globalRotationAssessments: [premarketGlobalFixture({ id: "structural", horizon: "structural" })],
  });
  const output = run(scenario);
  assert.equal(output.globalMarketState, TrafficLight.GREY);
  assert.ok(output.confidence.degradedBy.some((reason) => reason.includes("Long-horizon")));
  assert.equal(output.evidenceRefs.some((item) => item.field.includes("global.context")), false);
});

test("US/global disagreement remains explicit opposition", () => {
  const output = run(PREMARKET_INTELLIGENCE_SCENARIOS.GLOBAL_US_DISAGREEMENT);
  assert.equal(output.globalMarketState, TrafficLight.RED);
  assert.equal(output.compositeState, TrafficLight.ORANGE);
  assert.ok(output.opposingEvidence.some((item) => item.field.includes("global.context")));
  assert.ok(output.confidence.degradedBy.some((reason) => reason.includes("disagree")));
});

test("PremarketSnapshot is LIVE before explicit regular open", () => {
  const output = run(PREMARKET_INTELLIGENCE_SCENARIOS.ALL_CONSTRUCTIVE);
  assert.equal(output.freezeStatus, PremarketFreezeStatus.LIVE);
  assert.equal(output.frozenAt, null);
});

test("PremarketSnapshot freezes exactly at explicit regularOpenTimestamp", () => {
  const output = run(PREMARKET_INTELLIGENCE_SCENARIOS.FREEZE_AT_OPEN);
  assert.equal(output.freezeStatus, PremarketFreezeStatus.FROZEN);
  assert.equal(output.timestamp, PREMARKET_REGULAR_OPEN);
  assert.equal(output.frozenAt, PREMARKET_REGULAR_OPEN);
  assert.equal(output.regularOpenTimestamp, PREMARKET_REGULAR_OPEN);
});

test("later process evaluation cannot change frozen canonical bytes", () => {
  const atOpen = run(PREMARKET_INTELLIGENCE_SCENARIOS.FREEZE_AT_OPEN);
  const later = run(cloneScenario(PREMARKET_INTELLIGENCE_SCENARIOS.FREEZE_AT_OPEN, { evaluatedAt: "2026-01-15T14:35:00.000Z" }));
  assert.equal(deterministicSerialize("PremarketSnapshot", later), deterministicSerialize("PremarketSnapshot", atOpen));
});

test("post-open MarketSnapshot cannot rewrite frozen state", () => {
  assert.throws(() => run(PREMARKET_INTELLIGENCE_SCENARIOS.POST_OPEN_MUTATION_REJECTION), /Future data is forbidden|Post-open evidence is forbidden/);
});

test("post-open CatalystEvent cannot rewrite frozen state", () => {
  const event = premarketCatalystFixture({ id: "post-open", timestamp: "2026-01-15T14:31:00.000Z", scheduled: false, scheduledAt: null });
  const scenario = cloneScenario(PREMARKET_INTELLIGENCE_SCENARIOS.FREEZE_AT_OPEN, { catalystEvents: [event], evaluatedAt: "2026-01-15T14:35:00.000Z" });
  assert.throws(() => run(scenario), /Future data is forbidden|Post-open evidence is forbidden/);
});

test("later DiscoveryCandidate cannot rewrite frozen state", () => {
  const candidate = premarketDiscoveryFixture({ id: "post-open", timestamp: "2026-01-15T14:31:00.000Z" });
  const scenario = cloneScenario(PREMARKET_INTELLIGENCE_SCENARIOS.FREEZE_AT_OPEN, { discoveryCandidates: [candidate], evaluatedAt: "2026-01-15T14:35:00.000Z" });
  assert.throws(() => run(scenario), /Future data is forbidden|Post-open evidence is forbidden/);
});

test("frozen output and nested structures are immutable", () => {
  const output = run(PREMARKET_INTELLIGENCE_SCENARIOS.FREEZE_AT_OPEN);
  assert.equal(Object.isFrozen(output), true);
  assert.equal(Object.isFrozen(output.windowAssessments), true);
  assert.equal(Object.isFrozen(output.windowAssessments[0].supportingEvidence), true);
  assert.throws(() => output.windowAssessments.push({}), TypeError);
});

test("append-only frozen store rejects same-identity byte mutation", () => {
  const output = run(PREMARKET_INTELLIGENCE_SCENARIOS.FREEZE_AT_OPEN);
  const store = new PremarketSnapshotStore();
  store.append(output);
  const altered = structuredClone(output);
  altered.compositeState = altered.compositeState === TrafficLight.GREEN ? TrafficLight.ORANGE : TrafficLight.GREEN;
  assert.throws(() => store.append(altered), /mutation is forbidden/);
  assert.equal(deterministicSerialize("PremarketSnapshot", store.get(output.snapshotId)), deterministicSerialize("PremarketSnapshot", output));
});

test("AI Discovered remains separate and cannot populate My Focus", () => {
  const output = run(PREMARKET_INTELLIGENCE_SCENARIOS.AI_DISCOVERED_PREMARKET);
  assert.deepEqual(output.focusStocks, []);
  assert.deepEqual(output.discoveredStocks.map((item) => item.symbol), ["DISC"]);
});

test("unowned stock input is not inferred to be My Focus", () => {
  const output = run(PREMARKET_INTELLIGENCE_SCENARIOS.FOCUS_STOCK_RISK);
  assert.deepEqual(output.focusStocks, []);
  assert.deepEqual(output.discoveredStocks, []);
});

test("same inputs produce byte-identical canonical output", () => {
  const scenario = PREMARKET_INTELLIGENCE_SCENARIOS.ALL_CONSTRUCTIVE;
  assert.equal(canonicalize(run(scenario)), canonicalize(run(scenario)));
  assert.equal(deterministicSerialize("PremarketSnapshot", run(scenario)), deterministicSerialize("PremarketSnapshot", run(scenario)));
});

test("reordered semantically unordered arrays produce identical output", () => {
  const scenario = PREMARKET_INTELLIGENCE_SCENARIOS.DETERMINISTIC_ORDERING;
  const reordered = cloneScenario(scenario, {
    futuresSnapshots: [...scenario.futuresSnapshots].reverse(),
    premarketStockSnapshots: [...scenario.premarketStockSnapshots].reverse(),
    sectorSnapshots: [...scenario.sectorSnapshots].reverse(),
    globalRotationAssessments: [...scenario.globalRotationAssessments].reverse(),
  });
  assert.equal(canonicalize(run(scenario)), canonicalize(run(reordered)));
});

test("assessment, evidence, source and sector ordering is deterministic", () => {
  const output = run(PREMARKET_INTELLIGENCE_SCENARIOS.DETERMINISTIC_ORDERING);
  assert.deepEqual(output.windowAssessments.map((item) => item.window), ["AFTERHOURS", "OVERNIGHT", "PREMARKET"]);
  for (const field of ["supportingEvidence", "opposingEvidence", "evidenceRefs"]) {
    const ids = output[field].map((item) => item.evidenceId);
    assert.deepEqual(ids, [...ids].sort());
  }
  assert.deepEqual(output.sourceSnapshotIds, [...output.sourceSnapshotIds].sort());
  assert.deepEqual(output.sectorStates, ["ENERGY:GREEN", "UTILITIES:GREEN"]);
  assert.match(output.snapshotId, /^premarket-snapshot\|0\.4-shadow\|/);
});

test("Package 004 rule profile is versioned, synthetic, EXPERIMENTAL and SHADOW", () => {
  assert.equal(PREMARKET_INTELLIGENCE_RULE_PROFILE.ruleProfileId, "premarket-intelligence.experimental.v0.4");
  assert.equal(PREMARKET_INTELLIGENCE_RULE_PROFILE.version, "0.4.0");
  assert.equal(PREMARKET_INTELLIGENCE_RULE_PROFILE.engineId, "premarket-intelligence-engine");
  assert.equal(PREMARKET_INTELLIGENCE_RULE_PROFILE.engineVersion, "0.4-shadow");
  assert.equal(PREMARKET_INTELLIGENCE_RULE_PROFILE.status, "EXPERIMENTAL");
  assert.equal(PREMARKET_INTELLIGENCE_RULE_PROFILE.lifecycle, FeatureLifecycle.SHADOW);
  assert.match(PREMARKET_INTELLIGENCE_RULE_PROFILE.description, /Synthetic|synthetic/);
  assert.match(PREMARKET_INTELLIGENCE_RULE_PROFILE.description, /not production-calibrated/);
  assert.match(PREMARKET_INTELLIGENCE_RULE_PROFILE.description, /not empirically validated/);
  assert.equal(RULE_PROFILES.includes(PREMARKET_INTELLIGENCE_RULE_PROFILE), true);
});

test("Premarket engine, output and feature flag remain SHADOW and non-composite", () => {
  const output = run(PREMARKET_INTELLIGENCE_SCENARIOS.ALL_CONSTRUCTIVE);
  const registry = new FeatureFlagRegistry();
  assert.equal(registry.get("premarketIntelligence"), FeatureLifecycle.SHADOW);
  assert.equal(registry.canCompute("premarketIntelligence"), true);
  assert.equal(registry.canRender("premarketIntelligence"), false);
  assert.equal(registry.canInfluenceComposite("premarketIntelligence"), false);
  assert.equal(output.engineMeta.lifecycle, FeatureLifecycle.SHADOW);
  assert.equal(output.windowAssessments.every((item) => item.engineMeta.lifecycle === FeatureLifecycle.SHADOW), true);
  assert.equal(Object.values(registry.snapshot()).includes(FeatureLifecycle.ACTIVE), false);
});

test("Premarket engine imports no providers and performs no network or timezone inference", async () => {
  const source = await readFile(new URL("../engines/premarket-intelligence-engine.js", import.meta.url), "utf8");
  assert.doesNotMatch(source, /adapters\//);
  assert.doesNotMatch(source, /\b(?:fetch|XMLHttpRequest|WebSocket)\s*\(/);
  assert.doesNotMatch(source, /https?:\/\//i);
  assert.doesNotMatch(source, /09:30|America\/New_York|Intl\.DateTimeFormat|toLocaleTimeString/);
  assert.doesNotMatch(source, /from\s+["'][^"']*(?:provider|adapter|vendor)[^"']*["']/i);
});

test("UI contains no Package 004 analytical implementation", async () => {
  const source = await readFile(new URL("../ui/render-shell.js", import.meta.url), "utf8");
  assert.doesNotMatch(source, /premarket-intelligence-engine|evaluatePremarketIntelligence|MarketSessionBoundary|PremarketWindowAssessment/);
});

test("output contains no Stock Decision, trade-zone, prediction or broker semantics", () => {
  const serialized = canonicalize(run(PREMARKET_INTELLIGENCE_SCENARIOS.ALL_CONSTRUCTIVE));
  for (const term of ["targetPrice", "positionSize", "orderType", "brokerAction", "PredictionRecord", "TradeDecisionZone", "StockDecisionState", "baseProbability", "bullProbability", "bearProbability"]) {
    assert.equal(serialized.includes(term), false);
  }
});
