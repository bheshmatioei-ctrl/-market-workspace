import { discoveryCandidateId } from "../contracts/anomaly-discovery.js";
import {
  CatalystImpactTier,
  EvidenceType,
  FeatureLifecycle,
  FreshnessStatus,
  GlobalRotationState,
  LiquidityQuality,
  PremarketWindow,
  SCHEMA_VERSION,
  SessionPhase,
  TrafficLight,
} from "../domain/constants.js";

export const PREMARKET_MOCK_DATA_NOTICE = "MOCK / TEST DATA ONLY — NOT LIVE MARKET DATA";
export const PREMARKET_SESSION_DATE = "2026-01-15";
export const PREMARKET_CALENDAR_ID = "mock.us-equities.explicit.v1";
export const PREMARKET_EVALUATED_AT = "2026-01-15T14:25:00.000Z";
export const PREMARKET_REGULAR_OPEN = "2026-01-15T14:30:00.000Z";

const TIMES = Object.freeze({
  [PremarketWindow.AFTERHOURS]: "2026-01-14T22:00:00.000Z",
  [PremarketWindow.OVERNIGHT]: "2026-01-15T05:00:00.000Z",
  [PremarketWindow.PREMARKET]: "2026-01-15T14:20:00.000Z",
});
const PHASES = Object.freeze({
  [PremarketWindow.AFTERHOURS]: SessionPhase.AFTERHOURS,
  [PremarketWindow.OVERNIGHT]: SessionPhase.OVERNIGHT,
  [PremarketWindow.PREMARKET]: SessionPhase.PREMARKET,
});

function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value).forEach(deepFreeze);
  }
  return value;
}

const measurement = (value, unit, missingReason = null) => ({
  value,
  unit,
  missingReason: value === null ? missingReason ?? "MOCK measurement intentionally unavailable." : null,
});

function source(id, timestamp, { stale = false, observedAt = timestamp, receivedAt = timestamp } = {}) {
  return {
    schemaVersion: SCHEMA_VERSION,
    sourceId: `mock.premarket.${id}`,
    sourceName: PREMARKET_MOCK_DATA_NOTICE,
    sourceType: "derived",
    observedAt,
    receivedAt,
    reportingPeriodStart: null,
    reportingPeriodEnd: null,
    latencyClass: "realtime",
    freshnessSeconds: stale ? 9_999 : 0,
    isStale: stale,
    qualityScore: stale ? 0.3 : 0.9,
  };
}

function freshness(timestamp, status = FreshnessStatus.LIVE, ageSeconds = 0) {
  return {
    schemaVersion: SCHEMA_VERSION,
    status,
    assessedAt: timestamp,
    ageSeconds,
    reason: `${PREMARKET_MOCK_DATA_NOTICE}; explicit ${status} fixture.`,
    decisionGrade: ![FreshnessStatus.STALE, FreshnessStatus.UNAVAILABLE].includes(status),
  };
}

function confidence(score = 0.8, degradedBy = []) {
  return {
    schemaVersion: SCHEMA_VERSION,
    score,
    reasons: [PREMARKET_MOCK_DATA_NOTICE],
    degradedBy,
  };
}

function evidence(id, timestamp, field, value, unit, { type = EvidenceType.DIRECT, stale = false, observedAt, receivedAt } = {}) {
  return {
    schemaVersion: SCHEMA_VERSION,
    evidenceId: `mock.premarket.${id}`,
    sourceMeta: source(id, timestamp, { stale, observedAt, receivedAt }),
    field,
    value,
    unit,
    evidenceType: type,
  };
}

function sessionIdentity(window) {
  return {
    sessionDate: PREMARKET_SESSION_DATE,
    sessionPhase: PHASES[window],
    sessionCalendarId: PREMARKET_CALENDAR_ID,
  };
}

export function premarketBoundaryFixture(overrides = {}) {
  return deepFreeze({
    schemaVersion: SCHEMA_VERSION,
    sessionDate: PREMARKET_SESSION_DATE,
    sessionCalendarId: PREMARKET_CALENDAR_ID,
    priorRegularCloseTimestamp: "2026-01-14T21:00:00.000Z",
    afterhoursEndTimestamp: "2026-01-15T01:00:00.000Z",
    premarketStartTimestamp: "2026-01-15T09:00:00.000Z",
    regularOpenTimestamp: PREMARKET_REGULAR_OPEN,
    evidenceRefs: [evidence("boundary.calendar", "2026-01-14T20:00:00.000Z", "marketSessionBoundary", PREMARKET_CALENDAR_ID, null)],
    ...overrides,
  });
}

export function premarketFuturesFixture({
  id,
  instrument = "ES",
  window = PremarketWindow.PREMARKET,
  timestamp = TIMES[window],
  changePct = 0.6,
  stale = false,
  missingChange = false,
  sessionOverrides = {},
  sourceOverrides = {},
} = {}) {
  const sourceId = `futures.${id}`;
  const lastPrice = 5_000 * (1 + (changePct / 100));
  const snapshotEvidence = [
    evidence(`${sourceId}.lastPrice`, timestamp, "lastPrice.value", lastPrice, "index_points", { stale, ...sourceOverrides }),
    evidence(`${sourceId}.priorCashClose`, timestamp, "priorCashClose.value", 5_000, "index_points", { stale, ...sourceOverrides }),
    evidence(`${sourceId}.volume`, timestamp, "volume.value", 100_000, "contracts", { stale, ...sourceOverrides }),
  ];
  if (!missingChange) snapshotEvidence.push(evidence(`${sourceId}.changePct`, timestamp, "changePctFromPriorCashClose.value", changePct, "percent", { stale, ...sourceOverrides }));
  return deepFreeze({
    schemaVersion: SCHEMA_VERSION,
    snapshotId: `mock.premarket.futures.${id}`,
    timestamp,
    sessionIdentity: { ...sessionIdentity(window), ...sessionOverrides },
    instrument,
    lastPrice: measurement(lastPrice, "index_points"),
    priorCashClose: measurement(5_000, "index_points"),
    changePctFromPriorCashClose: measurement(missingChange ? null : changePct, "percent", "MOCK change intentionally missing."),
    volume: measurement(100_000, "contracts"),
    freshness: freshness(timestamp, stale ? FreshnessStatus.STALE : FreshnessStatus.LIVE, stale ? 9_999 : 0),
    evidenceRefs: snapshotEvidence.sort((left, right) => left.evidenceId < right.evidenceId ? -1 : 1),
    mockDataNotice: PREMARKET_MOCK_DATA_NOTICE,
  });
}

export function premarketMarketFixture({
  id,
  window = PremarketWindow.PREMARKET,
  timestamp = TIMES[window],
  price = 600,
  stale = false,
  sessionOverrides = {},
  sourceOverrides = {},
} = {}) {
  const values = { spy: price, qqq: price * 0.87, iwm: price * 0.37, dia: price * 0.74, vix: 18, ust2y: 4.1, ust10y: 4.25, dxy: 102, gold: 2_700, oil: 72 };
  const evidenceRefs = Object.entries(values).map(([field, value]) => evidence(`market.${id}.${field}`, timestamp, `${field}.value`, value, field === "vix" ? "index_points" : "normalized_units", { stale, ...sourceOverrides }));
  const identity = { ...sessionIdentity(window), ...sessionOverrides };
  return deepFreeze({
    schemaVersion: SCHEMA_VERSION,
    snapshotId: `mock.premarket.market.${id}`,
    timestamp,
    sessionDate: identity.sessionDate,
    sessionPhase: identity.sessionPhase,
    sessionIdentity: identity,
    ...Object.fromEntries(Object.entries(values).map(([field, value]) => [field, measurement(value, field === "vix" ? "index_points" : "normalized_units")])),
    bitcoinOptional: null,
    freshness: freshness(timestamp, stale ? FreshnessStatus.STALE : FreshnessStatus.LIVE, stale ? 9_999 : 0),
    evidenceRefs: evidenceRefs.sort((left, right) => left.evidenceId < right.evidenceId ? -1 : 1),
    mockDataNotice: PREMARKET_MOCK_DATA_NOTICE,
  });
}

export function premarketStockFixture({
  id,
  symbol = "MOCK",
  timestamp = TIMES[PremarketWindow.PREMARKET],
  gapPct = 2,
  relativeVolume = 2,
  liquidityQuality = LiquidityQuality.HIGH,
  stale = false,
  catalystEventIds = [],
  sectorId = "TECHNOLOGY",
  sourceOverrides = {},
} = {}) {
  const priorClose = 100;
  const premarketPrice = priorClose * (1 + ((gapPct ?? 0) / 100));
  const values = {
    priorClose,
    premarketPrice,
    gapPct,
    premarketVolume: 500_000,
    relativePremarketVolume: relativeVolume,
    dollarVolume: 50_000_000,
  };
  const units = { priorClose: "USD", premarketPrice: "USD", gapPct: "percent", premarketVolume: "shares", relativePremarketVolume: "ratio", dollarVolume: "USD" };
  const evidenceRefs = Object.entries(values).filter(([, value]) => value !== null).map(([field, value]) =>
    evidence(`stock.${id}.${field}`, timestamp, `${field}.value`, value, units[field], { stale, ...sourceOverrides }));
  return deepFreeze({
    schemaVersion: SCHEMA_VERSION,
    snapshotId: `mock.premarket.stock.${id}`,
    timestamp,
    sessionIdentity: sessionIdentity(PremarketWindow.PREMARKET),
    symbol,
    ...Object.fromEntries(Object.entries(values).map(([field, value]) => [field, measurement(value, units[field], `MOCK ${field} intentionally missing.`)])),
    sectorId,
    catalystEventIds: [...catalystEventIds].sort(),
    liquidityQuality,
    freshness: freshness(timestamp, stale ? FreshnessStatus.STALE : FreshnessStatus.LIVE, stale ? 9_999 : 0),
    evidenceRefs: evidenceRefs.sort((left, right) => left.evidenceId < right.evidenceId ? -1 : 1),
    mockDataNotice: PREMARKET_MOCK_DATA_NOTICE,
  });
}

export function premarketSectorFixture({
  id,
  window = PremarketWindow.PREMARKET,
  timestamp = TIMES[window],
  sectorId = "TECHNOLOGY",
  priceChangePct = 0.8,
  stale = false,
  sessionOverrides = {},
  sourceOverrides = {},
} = {}) {
  const sourceFields = [
    evidence(`sector.${id}.priceChangePct`, timestamp, "priceChangePct.value", priceChangePct, "percent", { stale, ...sourceOverrides }),
    evidence(`sector.${id}.relativeStrength`, timestamp, "relativeStrengthVsSPY.value", 0.4, "percentage_points", { stale, ...sourceOverrides }),
    evidence(`sector.${id}.relativeVolume`, timestamp, "relativeVolume.value", 1.2, "ratio", { stale, ...sourceOverrides }),
  ].sort((left, right) => left.evidenceId < right.evidenceId ? -1 : 1);
  return deepFreeze({
    schemaVersion: SCHEMA_VERSION,
    snapshotId: `mock.premarket.sector.${id}`,
    timestamp,
    sessionIdentity: { ...sessionIdentity(window), ...sessionOverrides },
    sectorId,
    benchmarkSymbol: "MOCK-XLK",
    priceChangePct: measurement(priceChangePct, "percent"),
    relativeStrengthVsSPY: measurement(0.4, "percentage_points"),
    relativeVolume: measurement(1.2, "ratio"),
    breadthPctPositive: null,
    upDownVolumeRatio: null,
    state: priceChangePct > 0 ? TrafficLight.GREEN : priceChangePct < 0 ? TrafficLight.RED : TrafficLight.ORANGE,
    confidence: confidence(stale ? 0.3 : 0.8, stale ? ["MOCK stale sector."] : []),
    evidenceRefs: sourceFields,
    mockDataNotice: PREMARKET_MOCK_DATA_NOTICE,
  });
}

export function premarketCatalystFixture({
  id,
  timestamp = "2026-01-15T14:00:00.000Z",
  scheduled = true,
  scheduledAt = "2026-01-15T14:28:00.000Z",
  impactTier = CatalystImpactTier.HIGH,
  symbol = "MOCK",
  sourceOverrides = {},
} = {}) {
  return deepFreeze({
    schemaVersion: SCHEMA_VERSION,
    eventId: `mock.premarket.event.${id}`,
    timestamp,
    eventType: "macro",
    scheduled,
    scheduledAt,
    sourceMeta: source(`event.${id}`, timestamp, sourceOverrides),
    headline: "MOCK scheduled catalyst",
    summary: PREMARKET_MOCK_DATA_NOTICE,
    affectedSymbols: [symbol],
    affectedSectors: ["US_MARKET"],
    factualImpact: scheduled && Date.parse(timestamp) < Date.parse(scheduledAt) ? "MOCK event remains pending." : "MOCK eligible released event fact.",
    marketReaction: null,
    interpretation: null,
    impactTier,
    confidence: confidence(0.75),
    mockDataNotice: PREMARKET_MOCK_DATA_NOTICE,
  });
}

export function premarketGlobalFixture({
  id,
  timestamp = "2026-01-15T14:15:00.000Z",
  countryOrRegion = "United States",
  horizon = "overnight",
  state = GlobalRotationState.POSITIVE_ROTATION,
  trafficLight = TrafficLight.GREEN,
} = {}) {
  const proxy = evidence(`global.${id}.proxy`, timestamp, "proxyRotationState", trafficLight, null, { type: EvidenceType.PROXY });
  const engineMeta = {
    engineId: "global-capital-rotation-engine",
    engineVersion: "0.2-shadow",
    lifecycle: FeatureLifecycle.SHADOW,
    evaluatedAt: timestamp,
    inputSchemaVersions: { CountryFlowSnapshot: SCHEMA_VERSION },
    ruleProfileId: "global-rotation.experimental.v0.2",
    deterministic: true,
  };
  return deepFreeze({
    schemaVersion: SCHEMA_VERSION,
    assessmentId: `mock.premarket.global.${id}`,
    timestamp,
    countryOrRegion,
    horizon,
    state,
    trafficLight,
    score: state === GlobalRotationState.INSUFFICIENT ? null : trafficLight === TrafficLight.GREEN ? 0.6 : trafficLight === TrafficLight.RED ? -0.6 : 0,
    equityState: trafficLight,
    bondState: TrafficLight.ORANGE,
    fxState: TrafficLight.ORANGE,
    relativeStrengthState: trafficLight,
    directFlowState: TrafficLight.GREY,
    directFlowValue: null,
    directFlowCurrency: null,
    confidence: confidence(0.7),
    directEvidence: [],
    proxyEvidence: [proxy],
    opposingEvidence: [],
    freshness: freshness(timestamp),
    engineMeta,
    mockDataNotice: PREMARKET_MOCK_DATA_NOTICE,
  });
}

export function premarketDiscoveryFixture({ id, symbol = "MOCK", timestamp = TIMES[PremarketWindow.PREMARKET] } = {}) {
  const engineMeta = {
    engineId: "anomaly-radar-engine",
    engineVersion: "0.3-shadow",
    lifecycle: FeatureLifecycle.SHADOW,
    evaluatedAt: timestamp,
    inputSchemaVersions: { StockSnapshot: SCHEMA_VERSION },
    ruleProfileId: "anomaly-radar.experimental.v0.3",
    deterministic: true,
  };
  const supportingEvidence = [evidence(`discovery.${id}.rvol`, timestamp, "relativeVolume.value", 2.5, "ratio", { type: EvidenceType.DERIVED })];
  return deepFreeze({
    schemaVersion: SCHEMA_VERSION,
    candidateId: discoveryCandidateId({ engineVersion: engineMeta.engineVersion, ruleProfileId: engineMeta.ruleProfileId, timestamp, symbol }),
    timestamp,
    symbol,
    anomalyTypes: ["RELATIVE_VOLUME_SPIKE"],
    severity: "watch",
    confidence: confidence(0.7),
    supportingEvidence,
    opposingEvidence: [],
    catalystEventIds: [],
    sectorId: "TECHNOLOGY",
    sourceSnapshotIds: [`mock.premarket.discovery-source.${id}`],
    freshness: freshness(timestamp),
    engineMeta,
    mockDataNotice: PREMARKET_MOCK_DATA_NOTICE,
  });
}

function futuresSet(prefix, window, values) {
  return ["ES", "NQ", "RTY"].map((instrument, index) => premarketFuturesFixture({
    id: `${prefix}.${instrument.toLowerCase()}`,
    instrument,
    window,
    changePct: values[index],
  }));
}

function scenario(name, overrides = {}) {
  return deepFreeze({
    name,
    notice: PREMARKET_MOCK_DATA_NOTICE,
    marketSessionBoundary: premarketBoundaryFixture(),
    futuresSnapshots: [],
    marketSnapshots: [],
    premarketStockSnapshots: [],
    sectorSnapshots: [],
    catalystEvents: [],
    globalRotationAssessments: [],
    discoveryCandidates: [],
    evaluatedAt: PREMARKET_EVALUATED_AT,
    ...overrides,
  });
}

const allConstructiveFutures = [
  ...futuresSet("all.afterhours", PremarketWindow.AFTERHOURS, [0.3, 0.4, 0.2]),
  ...futuresSet("all.overnight", PremarketWindow.OVERNIGHT, [0.4, 0.5, 0.3]),
  ...futuresSet("all.premarket", PremarketWindow.PREMARKET, [0.6, 0.8, 0.4]),
];
const broadStocks = [
  premarketStockFixture({ id: "broad.aaa", symbol: "AAA", gapPct: 2 }),
  premarketStockFixture({ id: "broad.bbb", symbol: "BBB", gapPct: 1 }),
];
const riskOffFutures = [
  ...futuresSet("risk.afterhours", PremarketWindow.AFTERHOURS, [-0.3, -0.4, -0.2]),
  ...futuresSet("risk.overnight", PremarketWindow.OVERNIGHT, [-0.4, -0.5, -0.3]),
  ...futuresSet("risk.premarket", PremarketWindow.PREMARKET, [-0.6, -0.8, -0.4]),
];
const premarketPositive = futuresSet("positive.premarket", PremarketWindow.PREMARKET, [0.6, 0.8, 0.4]);
const overnightNegative = futuresSet("negative.overnight", PremarketWindow.OVERNIGHT, [-0.5, -0.7, -0.3]);
const afterhoursPositive = futuresSet("positive.afterhours", PremarketWindow.AFTERHOURS, [0.4, 0.5, 0.2]);
const mixedFutures = futuresSet("mixed.premarket", PremarketWindow.PREMARKET, [0.8, 1.2, -0.9]);
const discoveredStock = premarketStockFixture({ id: "discovered", symbol: "DISC", gapPct: 3 });
const discoveredCandidate = premarketDiscoveryFixture({ id: "discovered", symbol: "DISC" });

export const PREMARKET_INTELLIGENCE_SCENARIOS = deepFreeze({
  ALL_CONSTRUCTIVE: scenario("ALL_CONSTRUCTIVE", {
    futuresSnapshots: allConstructiveFutures,
    premarketStockSnapshots: broadStocks,
    sectorSnapshots: [premarketSectorFixture({ id: "all", priceChangePct: 1 })],
    globalRotationAssessments: [premarketGlobalFixture({ id: "all" })],
  }),
  MIXED_FUTURES: scenario("MIXED_FUTURES", { futuresSnapshots: mixedFutures }),
  BROAD_RISK_OFF: scenario("BROAD_RISK_OFF", {
    futuresSnapshots: riskOffFutures,
    premarketStockSnapshots: [premarketStockFixture({ id: "risk.aaa", symbol: "AAA", gapPct: -2 }), premarketStockFixture({ id: "risk.bbb", symbol: "BBB", gapPct: -1 })],
    sectorSnapshots: [premarketSectorFixture({ id: "risk", priceChangePct: -1 })],
    globalRotationAssessments: [premarketGlobalFixture({ id: "risk", state: GlobalRotationState.NEGATIVE_ROTATION, trafficLight: TrafficLight.RED })],
  }),
  AFTERHOURS_ONLY: scenario("AFTERHOURS_ONLY", {
    futuresSnapshots: afterhoursPositive,
    evaluatedAt: "2026-01-14T23:00:00.000Z",
  }),
  OVERNIGHT_DETERIORATION: scenario("OVERNIGHT_DETERIORATION", {
    futuresSnapshots: [...afterhoursPositive, ...overnightNegative],
    evaluatedAt: "2026-01-15T06:00:00.000Z",
  }),
  PREMARKET_RECOVERY: scenario("PREMARKET_RECOVERY", { futuresSnapshots: [...overnightNegative, ...premarketPositive] }),
  OVERNIGHT_TO_PREMARKET_REVERSAL: scenario("OVERNIGHT_TO_PREMARKET_REVERSAL", { futuresSnapshots: [...afterhoursPositive, ...overnightNegative, ...premarketPositive] }),
  WINDOW_SEPARATION: scenario("WINDOW_SEPARATION", { futuresSnapshots: [...afterhoursPositive, ...overnightNegative, ...mixedFutures] }),
  FUTURE_INPUT_REJECTION: scenario("FUTURE_INPUT_REJECTION", {
    futuresSnapshots: [premarketFuturesFixture({ id: "future", timestamp: "2026-01-15T14:26:00.000Z" })],
  }),
  REGULAR_SESSION_INPUT_REJECTION: scenario("REGULAR_SESSION_INPUT_REJECTION", {
    marketSnapshots: [premarketMarketFixture({ id: "regular", sessionOverrides: { sessionPhase: SessionPhase.REGULAR } })],
  }),
  STALE_FUTURES: scenario("STALE_FUTURES", {
    futuresSnapshots: [premarketFuturesFixture({ id: "stale", stale: true })],
  }),
  STALE_MARKET_CONTEXT: scenario("STALE_MARKET_CONTEXT", {
    marketSnapshots: [
      premarketMarketFixture({ id: "stale.1", timestamp: "2026-01-15T14:10:00.000Z", price: 599, stale: true }),
      premarketMarketFixture({ id: "stale.2", price: 601, stale: true }),
    ],
  }),
  THIN_PREMARKET_LIQUIDITY: scenario("THIN_PREMARKET_LIQUIDITY", {
    futuresSnapshots: premarketPositive,
    premarketStockSnapshots: [premarketStockFixture({ id: "thin", liquidityQuality: LiquidityQuality.LOW, gapPct: 4 })],
  }),
  BROAD_PARTICIPATION: scenario("BROAD_PARTICIPATION", { premarketStockSnapshots: broadStocks }),
  CONCENTRATED_PARTICIPATION: scenario("CONCENTRATED_PARTICIPATION", {
    premarketStockSnapshots: [premarketStockFixture({ id: "concentrated.positive", symbol: "POS", gapPct: 2 }), premarketStockFixture({ id: "concentrated.neutral", symbol: "FLAT", gapPct: 0 })],
  }),
  HIGH_IMPACT_EVENT_PENDING: scenario("HIGH_IMPACT_EVENT_PENDING", {
    futuresSnapshots: premarketPositive,
    catalystEvents: [premarketCatalystFixture({ id: "pending-high", impactTier: CatalystImpactTier.HIGH })],
  }),
  HIGH_IMPACT_EVENT_RELEASED: scenario("HIGH_IMPACT_EVENT_RELEASED", {
    futuresSnapshots: premarketPositive,
    catalystEvents: [premarketCatalystFixture({ id: "released-high", timestamp: "2026-01-15T14:10:00.000Z", scheduledAt: "2026-01-15T14:10:00.000Z", impactTier: CatalystImpactTier.HIGH })],
  }),
  GLOBAL_US_DISAGREEMENT: scenario("GLOBAL_US_DISAGREEMENT", {
    futuresSnapshots: premarketPositive,
    globalRotationAssessments: [premarketGlobalFixture({ id: "disagree", state: GlobalRotationState.NEGATIVE_ROTATION, trafficLight: TrafficLight.RED })],
  }),
  FOCUS_STOCK_RISK: scenario("FOCUS_STOCK_RISK", {
    premarketStockSnapshots: [premarketStockFixture({ id: "unowned-risk", symbol: "RISK", gapPct: -4 })],
  }),
  AI_DISCOVERED_PREMARKET: scenario("AI_DISCOVERED_PREMARKET", {
    premarketStockSnapshots: [discoveredStock],
    discoveryCandidates: [discoveredCandidate],
  }),
  FREEZE_AT_OPEN: scenario("FREEZE_AT_OPEN", {
    futuresSnapshots: premarketPositive,
    evaluatedAt: PREMARKET_REGULAR_OPEN,
  }),
  POST_OPEN_MUTATION_REJECTION: scenario("POST_OPEN_MUTATION_REJECTION", {
    futuresSnapshots: premarketPositive,
    marketSnapshots: [premarketMarketFixture({ id: "post-open", timestamp: "2026-01-15T14:31:00.000Z", window: PremarketWindow.PREMARKET })],
    evaluatedAt: "2026-01-15T14:31:00.000Z",
  }),
  DETERMINISTIC_ORDERING: scenario("DETERMINISTIC_ORDERING", {
    futuresSnapshots: [...mixedFutures].reverse(),
    premarketStockSnapshots: [...broadStocks].reverse(),
    sectorSnapshots: [premarketSectorFixture({ id: "z", sectorId: "UTILITIES" }), premarketSectorFixture({ id: "a", sectorId: "ENERGY" })],
    globalRotationAssessments: [premarketGlobalFixture({ id: "z", countryOrRegion: "Japan" }), premarketGlobalFixture({ id: "a", countryOrRegion: "Germany" })],
  }),
});
