import {
  CatalystImpactTier,
  EvidenceType,
  FreshnessStatus,
  SCHEMA_VERSION,
  SessionPhase,
  StockAnalysisOrigin,
  TrafficLight,
} from "../domain/constants.js";
import { deepFreeze } from "../engines/engine-utils.js";
import { evaluateAnomalyRadar } from "../engines/anomaly-radar-engine.js";
import { ANOMALY_RADAR_SCENARIOS } from "./anomaly-radar-scenarios.js";

export const STOCK_DECISION_MOCK_NOTICE = "MOCK / TEST DATA ONLY — NOT LIVE MARKET DATA";
export const STOCK_DECISION_EVALUATED_AT = "2026-02-03T20:00:00.000Z";
const SESSION_IDENTITY = Object.freeze({ sessionDate: "2026-02-03", sessionPhase: SessionPhase.REGULAR, sessionCalendarId: "mock.us-equities.v1" });

const measurement = (value, unit, reason = null) => ({ value, unit, missingReason: value === null ? reason ?? "MOCK value intentionally missing." : null });
const source = (id, overrides = {}) => ({
  schemaVersion: SCHEMA_VERSION,
  sourceId: `mock.pkg006.${id}`,
  sourceName: STOCK_DECISION_MOCK_NOTICE,
  sourceType: "derived",
  observedAt: STOCK_DECISION_EVALUATED_AT,
  receivedAt: STOCK_DECISION_EVALUATED_AT,
  reportingPeriodStart: null,
  reportingPeriodEnd: null,
  latencyClass: "realtime",
  freshnessSeconds: 0,
  isStale: false,
  qualityScore: 0.9,
  ...overrides,
});
const evidence = (id, field, value, unit, type = EvidenceType.DIRECT, sourceOverrides = {}) => ({
  schemaVersion: SCHEMA_VERSION,
  evidenceId: `mock.pkg006.${id}`,
  sourceMeta: source(id, sourceOverrides),
  field,
  value,
  unit,
  evidenceType: type,
});
const freshness = (status = FreshnessStatus.LIVE) => ({
  schemaVersion: SCHEMA_VERSION,
  status,
  assessedAt: STOCK_DECISION_EVALUATED_AT,
  ageSeconds: status === FreshnessStatus.STALE ? 3600 : 0,
  reason: status === FreshnessStatus.STALE ? "MOCK record is intentionally stale." : STOCK_DECISION_MOCK_NOTICE,
  decisionGrade: ![FreshnessStatus.STALE, FreshnessStatus.UNAVAILABLE].includes(status),
});
const confidence = (score = 0.8, degradedBy = []) => ({ schemaVersion: SCHEMA_VERSION, score, reasons: [STOCK_DECISION_MOCK_NOTICE], degradedBy });

export function stockSubjectFixture({ id, symbol = "MOCK", origin = StockAnalysisOrigin.MY_FOCUS, discoveryCandidateId = null, selectedAt = STOCK_DECISION_EVALUATED_AT } = {}) {
  return deepFreeze({ schemaVersion: SCHEMA_VERSION, subjectId: `mock.pkg006.subject.${id}`, symbol, origin, selectedAt, discoveryCandidateId });
}

export function stockDecisionSnapshotFixture({
  id,
  symbol = "MOCK",
  timestamp = STOCK_DECISION_EVALUATED_AT,
  changePct = 1,
  relativeVolume = 2,
  distanceFromVWAPPct = 0.5,
  relativeStrengthVsBenchmark = 0.7,
  freshnessStatus = FreshnessStatus.LIVE,
  sessionIdentity = SESSION_IDENTITY,
  sectorId = "TECHNOLOGY",
} = {}) {
  const fields = { changePct, relativeVolume, distanceFromVWAPPct, relativeStrengthVsBenchmark };
  const units = { changePct: "percent", relativeVolume: "ratio", distanceFromVWAPPct: "percent", relativeStrengthVsBenchmark: "percentage_points" };
  const stale = freshnessStatus === FreshnessStatus.STALE;
  const evidenceRefs = Object.entries(fields).filter(([, value]) => value !== null).map(([field, value]) =>
    evidence(`stock.${id}.${field}`, `${field}.value`, value, units[field], EvidenceType.DIRECT, stale ? { isStale: true } : {}));
  return deepFreeze({
    schemaVersion: SCHEMA_VERSION,
    snapshotId: `mock.pkg006.stock.${id}`,
    timestamp,
    sessionIdentity,
    symbol,
    price: measurement(100 + (changePct ?? 0), "USD"),
    priorClose: measurement(100, "USD"),
    changePct: measurement(changePct, "percent"),
    volume: measurement(2_000_000, "shares"),
    avgVolume: measurement(1_000_000, "shares_per_session"),
    relativeVolume: measurement(relativeVolume, "ratio"),
    dollarVolume: measurement(200_000_000, "USD"),
    vwap: measurement(100, "USD"),
    distanceFromVWAPPct: measurement(distanceFromVWAPPct, "percent"),
    dayHigh: measurement(102, "USD"),
    dayLow: measurement(98, "USD"),
    relativeStrengthVsBenchmark: measurement(relativeStrengthVsBenchmark, "percentage_points"),
    sectorId,
    newsEventIds: [],
    freshness: freshness(freshnessStatus),
    evidenceRefs,
    mockDataNotice: STOCK_DECISION_MOCK_NOTICE,
  });
}

export function stockMarketDecisionFixture({ state = "RISK_ON", stale = false } = {}) {
  const positive = state === "RISK_ON";
  const item = evidence(`market.${state}`, "marketRegime", state, null, EvidenceType.DERIVED, stale ? { isStale: true } : {});
  return deepFreeze({
    schemaVersion: SCHEMA_VERSION,
    decisionId: `mock.pkg006.market.${state}.${stale ? "stale" : "live"}`,
    timestamp: STOCK_DECISION_EVALUATED_AT,
    scope: "MARKET",
    scopeId: "US_MARKET",
    state,
    trafficLight: positive ? TrafficLight.GREEN : state === "RISK_OFF" ? TrafficLight.RED : TrafficLight.ORANGE,
    score: positive ? 0.7 : state === "RISK_OFF" ? -0.7 : 0,
    confidence: confidence(stale ? 0.3 : 0.8, stale ? ["MOCK market context is stale."] : []),
    supportingEvidence: [item],
    opposingEvidence: [],
    freshness: freshness(stale ? FreshnessStatus.STALE : FreshnessStatus.LIVE),
    engineVersion: "mock.market-context.v1",
  });
}

export function stockSectorFixture({ id = "technology", state = TrafficLight.GREEN } = {}) {
  const value = state === TrafficLight.GREEN ? 1 : state === TrafficLight.RED ? -1 : 0;
  return deepFreeze({
    schemaVersion: SCHEMA_VERSION,
    snapshotId: `mock.pkg006.sector.${id}.${state}`,
    timestamp: STOCK_DECISION_EVALUATED_AT,
    sessionIdentity: SESSION_IDENTITY,
    sectorId: "TECHNOLOGY",
    benchmarkSymbol: "XLK",
    priceChangePct: measurement(value, "percent"),
    relativeStrengthVsSPY: measurement(value, "percentage_points"),
    relativeVolume: measurement(1.2, "ratio"),
    breadthPctPositive: null,
    upDownVolumeRatio: null,
    state,
    confidence: confidence(),
    evidenceRefs: [evidence(`sector.${id}.${state}`, "priceChangePct.value", value, "percent")],
    mockDataNotice: STOCK_DECISION_MOCK_NOTICE,
  });
}

export function stockCatalystFixture({ id = "earnings", symbol = "MOCK", impactTier = CatalystImpactTier.HIGH, scheduled = true, scheduledAt = "2026-02-03T21:00:00.000Z" } = {}) {
  return deepFreeze({
    schemaVersion: SCHEMA_VERSION,
    eventId: `mock.pkg006.event.${id}`,
    timestamp: "2026-02-03T19:55:00.000Z",
    eventType: "earnings",
    scheduled,
    scheduledAt: scheduled ? scheduledAt : null,
    sourceMeta: source(`event.${id}`, { observedAt: "2026-02-03T19:55:00.000Z", receivedAt: "2026-02-03T19:55:00.000Z" }),
    headline: "MOCK scheduled earnings risk",
    summary: STOCK_DECISION_MOCK_NOTICE,
    affectedSymbols: [symbol],
    affectedSectors: ["TECHNOLOGY"],
    factualImpact: "MOCK pending risk; occurrence is not asserted.",
    marketReaction: null,
    interpretation: null,
    confidence: confidence(),
    impactTier,
    mockDataNotice: STOCK_DECISION_MOCK_NOTICE,
  });
}

function scenario(name, { symbol = name, stock = {}, market = {}, sector = TrafficLight.GREEN, subjects = null, catalystEvents = [], discoveryCandidates = [], stockSnapshots = null } = {}) {
  return deepFreeze({
    name,
    notice: STOCK_DECISION_MOCK_NOTICE,
    evaluatedAt: STOCK_DECISION_EVALUATED_AT,
    subjects: subjects ?? [stockSubjectFixture({ id: name.toLowerCase(), symbol })],
    stockSnapshots: stockSnapshots ?? [stockDecisionSnapshotFixture({ id: name.toLowerCase(), symbol, ...stock })],
    marketDecisionState: stockMarketDecisionFixture(market),
    directionAssessments: [],
    sectorSnapshots: [stockSectorFixture({ id: name.toLowerCase(), state: sector })],
    flowAssessments: [],
    catalystEvents,
    discoveryCandidates,
  });
}

const positive = { changePct: 1, relativeVolume: 2, distanceFromVWAPPct: 0.5, relativeStrengthVsBenchmark: 0.7 };
const buy = { ...positive, relativeStrengthVsBenchmark: 0 };
const neutral = { changePct: 0, relativeVolume: 1, distanceFromVWAPPct: 0, relativeStrengthVsBenchmark: 0 };
const negative = { changePct: -1, relativeVolume: 2, distanceFromVWAPPct: -0.5, relativeStrengthVsBenchmark: -0.7 };
const sell = { ...negative, relativeStrengthVsBenchmark: 0 };
const waitSymbol = "WAITEVT";
const waitEvent = stockCatalystFixture({ symbol: waitSymbol });
const selectedDiscoveryCandidate = evaluateAnomalyRadar(ANOMALY_RADAR_SCENARIOS.RVOL_SPIKE).discoveryCandidates[0];
const selectedDiscoverySubject = stockSubjectFixture({
  id: "ai-discovered-selected",
  symbol: selectedDiscoveryCandidate.symbol,
  origin: StockAnalysisOrigin.AI_DISCOVERED_SELECTED,
  discoveryCandidateId: selectedDiscoveryCandidate.candidateId,
});

export const STOCK_DECISION_SCENARIOS = deepFreeze({
  ACCUMULATION_CONFIRMED: scenario("ACCUMULATION_CONFIRMED", { stock: positive }),
  BUY_PRESSURE_CONFIRMED: scenario("BUY_PRESSURE_CONFIRMED", { stock: buy }),
  NEUTRAL_BALANCED: scenario("NEUTRAL_BALANCED", { stock: neutral, sector: TrafficLight.ORANGE, market: { state: "CONFLICTED" } }),
  CONFLICTED_STOCK_VS_MARKET: scenario("CONFLICTED_STOCK_VS_MARKET", { stock: positive, market: { state: "RISK_OFF" } }),
  CONFLICTED_STOCK_VS_SECTOR: scenario("CONFLICTED_STOCK_VS_SECTOR", { stock: positive, sector: TrafficLight.RED }),
  DISTRIBUTION_CONFIRMED: scenario("DISTRIBUTION_CONFIRMED", { stock: negative, market: { state: "RISK_OFF" }, sector: TrafficLight.RED }),
  SELL_PRESSURE_CONFIRMED: scenario("SELL_PRESSURE_CONFIRMED", { stock: sell, market: { state: "RISK_OFF" }, sector: TrafficLight.RED }),
  WAIT_EVENT_RISK_EARNINGS: scenario("WAIT_EVENT_RISK_EARNINGS", { symbol: waitSymbol, stock: positive, catalystEvents: [waitEvent] }),
  MISSING_RELATIVE_VOLUME: scenario("MISSING_RELATIVE_VOLUME", { stock: { ...positive, relativeVolume: null } }),
  MISSING_VWAP: scenario("MISSING_VWAP", { stock: { ...positive, distanceFromVWAPPct: null } }),
  STALE_STOCK_DATA: scenario("STALE_STOCK_DATA", { stock: { ...positive, freshnessStatus: FreshnessStatus.STALE } }),
  STALE_MARKET_CONTEXT: scenario("STALE_MARKET_CONTEXT", { stock: positive, market: { state: "RISK_ON", stale: true } }),
  MARKET_RISK_ON_CONFIRMATION: scenario("MARKET_RISK_ON_CONFIRMATION", { stock: positive }),
  MARKET_RISK_OFF_CONFLICT: scenario("MARKET_RISK_OFF_CONFLICT", { stock: positive, market: { state: "RISK_OFF" } }),
  SECTOR_CONFIRMATION: scenario("SECTOR_CONFIRMATION", { stock: positive, sector: TrafficLight.GREEN }),
  SECTOR_DIVERGENCE: scenario("SECTOR_DIVERGENCE", { stock: positive, sector: TrafficLight.RED }),
  RELATIVE_STRENGTH_CONFIRMATION: scenario("RELATIVE_STRENGTH_CONFIRMATION", { stock: positive }),
  RELATIVE_STRENGTH_DIVERGENCE: scenario("RELATIVE_STRENGTH_DIVERGENCE", { stock: { ...positive, relativeStrengthVsBenchmark: -0.7 } }),
  VWAP_RECLAIM_CONTEXT: scenario("VWAP_RECLAIM_CONTEXT", { stock: positive }),
  VWAP_BREAKDOWN_CONTEXT: scenario("VWAP_BREAKDOWN_CONTEXT", { stock: negative, market: { state: "RISK_OFF" }, sector: TrafficLight.RED }),
  MY_FOCUS_SUBJECT: scenario("MY_FOCUS_SUBJECT", { stock: positive }),
  AI_DISCOVERED_SELECTED_SUBJECT: scenario("AI_DISCOVERED_SELECTED_SUBJECT", {
    symbol: selectedDiscoveryCandidate.symbol,
    stock: positive,
    subjects: [selectedDiscoverySubject],
    discoveryCandidates: [selectedDiscoveryCandidate],
  }),
  AI_DISCOVERED_NOT_SELECTED_REJECTION: scenario("AI_DISCOVERED_NOT_SELECTED_REJECTION", {
    symbol: selectedDiscoveryCandidate.symbol,
    subjects: [],
    stock: positive,
    discoveryCandidates: [selectedDiscoveryCandidate],
  }),
  DETERMINISTIC_ORDERING: deepFreeze({
    ...scenario("DETERMINISTIC_ORDERING", { symbol: "ZZZ", stock: positive }),
    subjects: [stockSubjectFixture({ id: "zzz", symbol: "ZZZ" }), stockSubjectFixture({ id: "aaa", symbol: "AAA" })],
    stockSnapshots: [stockDecisionSnapshotFixture({ id: "zzz", symbol: "ZZZ", ...positive }), stockDecisionSnapshotFixture({ id: "aaa", symbol: "AAA", ...positive })],
  }),
});
