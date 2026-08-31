import {
  DirectionState,
  EvidenceType,
  FreshnessStatus,
  SCHEMA_VERSION,
  SessionPhase,
  TrafficLight,
} from "../domain/constants.js";

const MOCK_TIME = "2026-01-15T15:00:00.000Z";
const MOCK_SESSION = "2026-01-15";

export const measurement = (value, unit, missingReason = null) => Object.freeze({ value, unit, missingReason });

export const mockSource = (overrides = {}) => Object.freeze({
  schemaVersion: SCHEMA_VERSION,
  sourceId: "mock.fixture.foundation",
  sourceName: "MOCK TEST FIXTURE — NOT LIVE DATA",
  sourceType: "derived",
  observedAt: MOCK_TIME,
  receivedAt: MOCK_TIME,
  reportingPeriodStart: null,
  reportingPeriodEnd: null,
  latencyClass: "realtime",
  freshnessSeconds: 0,
  isStale: false,
  qualityScore: 0.9,
  ...overrides,
});

export const mockFreshness = (status = FreshnessStatus.LIVE, ageSeconds = 0, reason = "MOCK observation is inside the fixture threshold.") => Object.freeze({
  schemaVersion: SCHEMA_VERSION,
  status,
  assessedAt: MOCK_TIME,
  ageSeconds,
  reason,
  decisionGrade: ![FreshnessStatus.STALE, FreshnessStatus.UNAVAILABLE].includes(status),
});

export const mockConfidence = (score, reasons, degradedBy = []) => Object.freeze({
  schemaVersion: SCHEMA_VERSION,
  score,
  reasons: Object.freeze(reasons),
  degradedBy: Object.freeze(degradedBy),
});

export const mockEvidence = ({ id, field, value, unit, type = EvidenceType.DIRECT, source = mockSource() }) => Object.freeze({
  schemaVersion: SCHEMA_VERSION,
  evidenceId: id,
  sourceMeta: source,
  field,
  value,
  unit,
  evidenceType: type,
});

function marketSnapshot(snapshotId, values, freshness = mockFreshness()) {
  const evidenceRefs = [
    mockEvidence({ id: `${snapshotId}.spy`, field: "spy.value", value: values.spy, unit: "USD" }),
    mockEvidence({ id: `${snapshotId}.vix`, field: "vix.value", value: values.vix, unit: "index_points" }),
  ];
  return Object.freeze({
    schemaVersion: SCHEMA_VERSION,
    snapshotId,
    timestamp: MOCK_TIME,
    sessionDate: MOCK_SESSION,
    sessionPhase: SessionPhase.REGULAR,
    spy: measurement(values.spy, "USD"),
    qqq: measurement(values.qqq, "USD"),
    iwm: measurement(values.iwm, "USD"),
    dia: measurement(values.dia, "USD"),
    vix: measurement(values.vix, "index_points"),
    ust2y: measurement(values.ust2y, "percent_yield"),
    ust10y: measurement(values.ust10y, "percent_yield"),
    dxy: measurement(values.dxy, "index_points"),
    gold: measurement(values.gold, "USD_per_troy_ounce"),
    oil: measurement(values.oil, "USD_per_barrel"),
    bitcoinOptional: measurement(null, "USD", "Optional secondary risk proxy omitted from this fixture."),
    freshness,
    evidenceRefs: Object.freeze(evidenceRefs),
  });
}

export const constructiveMarketSnapshot = marketSnapshot("mock.market.constructive", {
  spy: 600.25, qqq: 520.4, iwm: 225.15, dia: 445.7, vix: 14.2, ust2y: 4.08, ust10y: 4.22, dxy: 101.4, gold: 2680, oil: 72.3,
});

export const riskOffMarketSnapshot = marketSnapshot("mock.market.risk-off", {
  spy: 575.1, qqq: 493.2, iwm: 208.3, dia: 426.8, vix: 27.6, ust2y: 4.3, ust10y: 4.55, dxy: 104.9, gold: 2745, oil: 67.8,
});

export const conflictedMarketSnapshot = marketSnapshot("mock.market.conflicted", {
  spy: 590.3, qqq: 515.6, iwm: 211.4, dia: 438.2, vix: 20.1, ust2y: 4.18, ust10y: 4.37, dxy: 103.1, gold: 2710, oil: 70.2,
}, mockFreshness(FreshnessStatus.DEGRADED, 75, "MOCK breadth companion input is intentionally degraded."));

function stockSnapshot(symbol, list, price, priorClose, volume, state, index) {
  const changePct = ((price / priorClose) - 1) * 100;
  return Object.freeze({
    schemaVersion: SCHEMA_VERSION,
    snapshotId: `mock.stock.${list}.${symbol.toLowerCase()}`,
    timestamp: MOCK_TIME,
    symbol,
    price: measurement(price, "USD"),
    priorClose: measurement(priorClose, "USD"),
    changePct: measurement(Number(changePct.toFixed(2)), "percent"),
    volume: measurement(volume, "shares"),
    avgVolume: measurement(volume * 0.8, "shares_per_session"),
    relativeVolume: measurement(Number((1.1 + index * 0.18).toFixed(2)), "ratio"),
    dollarVolume: measurement(Number((price * volume).toFixed(0)), "USD"),
    vwap: measurement(Number((price * 0.997).toFixed(2)), "USD"),
    distanceFromVWAPPct: measurement(0.3, "percent"),
    dayHigh: measurement(Number((price * 1.012).toFixed(2)), "USD"),
    dayLow: measurement(Number((price * 0.985).toFixed(2)), "USD"),
    relativeStrengthVsBenchmark: measurement(state === TrafficLight.RED ? -0.8 : 0.7, "percentage_points"),
    sectorId: index % 2 === 0 ? "TECHNOLOGY" : "INDUSTRIALS",
    newsEventIds: Object.freeze([]),
    freshness: mockFreshness(),
    evidenceRefs: Object.freeze([
      mockEvidence({ id: `mock.stock.${list}.${symbol}.price`, field: "price.value", value: price, unit: "USD" }),
    ]),
    mockPresentationState: state,
  });
}

export const focusStocks = Object.freeze([
  stockSnapshot("NVDA", "focus", 142.4, 140.1, 48_000_000, TrafficLight.GREEN, 0),
  stockSnapshot("AMZN", "focus", 225.3, 224.8, 22_000_000, TrafficLight.ORANGE, 1),
  stockSnapshot("INTC", "focus", 21.8, 22.35, 39_000_000, TrafficLight.RED, 2),
  stockSnapshot("MSFT", "focus", 468.6, 466.9, 14_000_000, TrafficLight.GREEN, 3),
  stockSnapshot("XOM", "focus", 111.2, 111.4, 9_500_000, TrafficLight.GREY, 4),
]);

export const discoveredStocks = Object.freeze([
  stockSnapshot("AVGO", "discovered", 238.2, 229.4, 31_000_000, TrafficLight.GREEN, 0),
  stockSnapshot("PLTR", "discovered", 79.4, 75.2, 72_000_000, TrafficLight.GREEN, 1),
  stockSnapshot("SMCI", "discovered", 44.1, 46.8, 41_000_000, TrafficLight.RED, 2),
  stockSnapshot("FSLR", "discovered", 196.5, 193.6, 7_800_000, TrafficLight.ORANGE, 3),
  stockSnapshot("SOFI", "discovered", 15.7, 15.1, 54_000_000, TrafficLight.GREEN, 4),
]);

export const directAssetFlow = Object.freeze({
  schemaVersion: SCHEMA_VERSION,
  snapshotId: "mock.asset-flow.direct.us-equity",
  timestamp: MOCK_TIME,
  assetClass: "US_EQUITY",
  flowValue: measurement(1.25, "USD_billions"),
  currency: "USD",
  flowPeriod: "daily",
  flowType: EvidenceType.DIRECT,
  proxyState: null,
  methodologyId: "mock.direct.fixture.v1",
  confidence: mockConfidence(0.82, ["Explicit MOCK measured-flow fixture with reporting period."], []),
  sourceMeta: mockSource({
    latencyClass: "daily",
    reportingPeriodStart: "2026-01-14T00:00:00.000Z",
    reportingPeriodEnd: "2026-01-14T23:59:59.000Z",
  }),
  evidenceRefs: Object.freeze([
    mockEvidence({ id: "mock.flow.direct.value", field: "flowValue.value", value: 1.25, unit: "USD_billions", type: EvidenceType.DIRECT }),
  ]),
});

export const proxyAssetFlow = Object.freeze({
  schemaVersion: SCHEMA_VERSION,
  snapshotId: "mock.asset-flow.proxy.us-equity",
  timestamp: MOCK_TIME,
  assetClass: "US_EQUITY",
  flowValue: null,
  currency: null,
  flowPeriod: "intraday",
  flowType: EvidenceType.PROXY,
  proxyState: TrafficLight.ORANGE,
  methodologyId: "mock.proxy.participation.fixture.v1",
  confidence: mockConfidence(0.61, ["MOCK price-volume participation proxy."], ["Proxy is not measured cash flow."]),
  sourceMeta: mockSource({ sourceId: "mock.proxy.fixture", sourceName: "MOCK PROXY FIXTURE — NOT CASH FLOW" }),
  evidenceRefs: Object.freeze([
    mockEvidence({ id: "mock.flow.proxy.up-down-volume", field: "upDownVolumeRatio", value: 0.92, unit: "ratio", type: EvidenceType.PROXY }),
  ]),
});

export const usAssetFlowState = Object.freeze([directAssetFlow, proxyAssetFlow]);

function countryFlow({ id, country, horizon, direct, equityValue = null, proxy, fx, bond, relative, composite, score, degradedBy = [] }) {
  const evidence = [
    mockEvidence({ id: `${id}.proxy`, field: "proxyRotationState", value: proxy, unit: null, type: EvidenceType.PROXY }),
  ];
  if (direct) evidence.push(mockEvidence({ id: `${id}.direct`, field: "equityFlowValue.value", value: equityValue, unit: "USD_millions", type: EvidenceType.DIRECT }));
  return Object.freeze({
    schemaVersion: SCHEMA_VERSION,
    snapshotId: id,
    timestamp: MOCK_TIME,
    countryOrRegion: country,
    horizon,
    equityFlowValue: direct ? measurement(equityValue, "USD_millions") : null,
    bondFlowValue: null,
    directFlowAvailable: direct,
    proxyRotationState: proxy,
    fxState: fx,
    sovereignBondState: bond,
    relativeStrengthState: relative,
    compositeState: composite,
    confidence: mockConfidence(score, ["MOCK multi-asset rotation fixture."], degradedBy),
    evidenceRefs: Object.freeze(evidence),
  });
}

export const globalCapitalRotationState = Object.freeze([
  countryFlow({ id: "mock.country.us", country: "United States", horizon: "1d", direct: true, equityValue: 620, proxy: TrafficLight.ORANGE, fx: TrafficLight.GREEN, bond: TrafficLight.ORANGE, relative: TrafficLight.GREEN, composite: TrafficLight.ORANGE, score: 0.72, degradedBy: ["Direct and proxy evidence disagree."] }),
  countryFlow({ id: "mock.country.jp", country: "Japan", horizon: "1d", direct: false, proxy: TrafficLight.GREEN, fx: TrafficLight.GREEN, bond: TrafficLight.ORANGE, relative: TrafficLight.GREEN, composite: TrafficLight.GREEN, score: 0.76 }),
  countryFlow({ id: "mock.country.br", country: "Brazil", horizon: "1d", direct: false, proxy: TrafficLight.GREY, fx: TrafficLight.ORANGE, bond: TrafficLight.GREY, relative: TrafficLight.GREY, composite: TrafficLight.GREY, score: 0.29, degradedBy: ["Required direct flow unavailable.", "Proxy components incomplete."] }),
]);

export const premarketSnapshot = Object.freeze({
  schemaVersion: SCHEMA_VERSION,
  snapshotId: "mock.premarket.foundation",
  timestamp: "2026-01-15T13:15:00.000Z",
  sessionDate: MOCK_SESSION,
  futuresState: TrafficLight.ORANGE,
  macroRiskState: TrafficLight.RED,
  globalMarketState: TrafficLight.ORANGE,
  participationState: TrafficLight.GREY,
  sectorStates: Object.freeze(["SEMICONDUCTORS:GREEN", "ENERGY:ORANGE", "SMALL_CAPS:RED"]),
  focusStocks,
  discoveredStocks,
  scheduledEventIds: Object.freeze(["mock.event.cpi"]),
  newsEventIds: Object.freeze([]),
  compositeState: TrafficLight.ORANGE,
  directionState: DirectionState.DETERIORATING,
  confidence: mockConfidence(0.58, ["MOCK overnight inputs are mixed."], ["Scheduled event not yet released.", "Participation data unavailable."]),
  freshness: Object.freeze({ ...mockFreshness(), assessedAt: "2026-01-15T13:15:00.000Z" }),
  evidenceRefs: Object.freeze([
    mockEvidence({ id: "mock.premarket.futures", field: "futuresState", value: TrafficLight.ORANGE, unit: null, type: EvidenceType.DERIVED }),
  ]),
});

export const marketDecisionState = Object.freeze({
  schemaVersion: SCHEMA_VERSION,
  decisionId: "mock.decision.market.conflicted",
  timestamp: MOCK_TIME,
  scope: "MARKET",
  scopeId: "US_MARKET",
  state: "CONFLICTED",
  trafficLight: TrafficLight.ORANGE,
  score: 0.12,
  confidence: mockConfidence(0.64, ["MOCK trend strength is opposed by breadth weakness."], ["One component is degraded."]),
  supportingEvidence: Object.freeze([
    mockEvidence({ id: "mock.decision.support", field: "qqqRelativeStrength", value: 0.9, unit: "percentage_points", type: EvidenceType.DERIVED }),
  ]),
  opposingEvidence: Object.freeze([
    mockEvidence({ id: "mock.decision.oppose", field: "advanceDeclineRatio", value: 0.78, unit: "ratio", type: EvidenceType.PROXY }),
  ]),
  freshness: conflictedMarketSnapshot.freshness,
  engineVersion: "foundation.mock-state.v1",
});

export const predictionRecordFixture = Object.freeze({
  schemaVersion: SCHEMA_VERSION,
  predictionId: "mock.prediction.001",
  issuedAt: MOCK_TIME,
  scope: "MARKET",
  symbolOrScopeId: "US_MARKET",
  modelVersion: "foundation.no-predictive-model.v1",
  horizon: "60m",
  referencePrice: measurement(590.3, "USD"),
  predictedDirection: "TEST_ONLY_UNKNOWN",
  expectedMoveLowPct: null,
  expectedMoveHighPct: null,
  confidence: mockConfidence(0.2, ["Storage-only fixture; no predictive algorithm exists."], ["Not decision-grade."]),
  marketRegimeAtIssue: "CONFLICTED",
  evidenceSnapshotHash: "mock-sha256-8efb73c587aa4e493d9811f11719533b",
  evidenceRefs: marketDecisionState.supportingEvidence,
});

export const mockCockpitState = Object.freeze({
  mode: "MOCK",
  modeLabel: "MOCK / ARCHITECTURE VALIDATION — NOT LIVE MARKET DATA",
  generatedAt: MOCK_TIME,
  marketStates: Object.freeze({
    constructive: constructiveMarketSnapshot,
    riskOff: riskOffMarketSnapshot,
    conflicted: conflictedMarketSnapshot,
  }),
  selectedMarket: conflictedMarketSnapshot,
  marketDecision: marketDecisionState,
  directions: Object.freeze({
    "30m": DirectionState.IMPROVING,
    "60m": DirectionState.STABLE,
    "2h": DirectionState.DETERIORATING,
    Session: DirectionState.UNKNOWN,
  }),
  assetFlows: usAssetFlowState,
  globalCapital: globalCapitalRotationState,
  premarket: premarketSnapshot,
  focusStocks,
  discoveredStocks,
  placeholders: Object.freeze(["Money Flow", "Live Alerts", "Market Internals", "Macro / Risk", "Decision Timeline"]),
});

