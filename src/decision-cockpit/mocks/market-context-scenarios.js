import { EvidenceType, FreshnessStatus, SCHEMA_VERSION, SessionPhase, TrafficLight } from "../domain/constants.js";
import { deepFreeze } from "../engines/engine-utils.js";

export const MOCK_DATA_NOTICE = "MOCK / TEST DATA ONLY — NOT LIVE MARKET DATA";
const CURRENT = "2026-02-03T20:00:00.000Z";
const SESSION_START = "2026-02-03T14:30:00.000Z";
const SESSION_IDENTITY = Object.freeze({ sessionDate: "2026-02-03", sessionPhase: SessionPhase.REGULAR, sessionCalendarId: "mock.us-equities.v1" });
const TIMES = Object.freeze([SESSION_START, "2026-02-03T18:00:00.000Z", "2026-02-03T19:00:00.000Z", "2026-02-03T19:30:00.000Z", CURRENT]);

const measurement = (value, unit, missingReason = null) => Object.freeze({ value, unit, missingReason });
const source = (id, observedAt, overrides = {}) => Object.freeze({
  schemaVersion: SCHEMA_VERSION,
  sourceId: `mock.pkg002.${id}`,
  sourceName: MOCK_DATA_NOTICE,
  sourceType: "derived",
  observedAt,
  receivedAt: observedAt,
  reportingPeriodStart: null,
  reportingPeriodEnd: null,
  latencyClass: "realtime",
  freshnessSeconds: 0,
  isStale: false,
  qualityScore: 0.9,
  ...overrides,
});
const evidence = (id, field, value, unit, type, observedAt, sourceOverrides = {}) => Object.freeze({
  schemaVersion: SCHEMA_VERSION,
  evidenceId: `mock.pkg002.${id}`,
  sourceMeta: source(id, observedAt, sourceOverrides),
  field,
  value,
  unit,
  evidenceType: type,
});
const freshness = (timestamp, stale = false) => Object.freeze({
  schemaVersion: SCHEMA_VERSION,
  status: stale ? FreshnessStatus.STALE : FreshnessStatus.LIVE,
  assessedAt: timestamp,
  ageSeconds: stale ? 3600 : 0,
  reason: stale ? "MOCK scenario intentionally stale." : "MOCK snapshot timestamp is current for the scenario.",
  decisionGrade: !stale,
});
const confidence = (score = 0.8, degradedBy = []) => Object.freeze({ schemaVersion: SCHEMA_VERSION, score, reasons: Object.freeze([MOCK_DATA_NOTICE]), degradedBy: Object.freeze(degradedBy) });

function market(name, timestamp, price, change, { vix = 16, stale = false, smallCapFactor = 1 } = {}) {
  const spy = price;
  return Object.freeze({
    schemaVersion: SCHEMA_VERSION,
    snapshotId: `mock.pkg002.${name}.market.${timestamp}`,
    timestamp,
    sessionDate: "2026-02-03",
    sessionPhase: SessionPhase.REGULAR,
    sessionIdentity: SESSION_IDENTITY,
    spy: measurement(spy, "USD"), qqq: measurement(spy * 0.86 * (1 + change / 600), "USD"),
    iwm: measurement(spy * 0.37 * smallCapFactor, "USD"), dia: measurement(spy * 0.74, "USD"),
    vix: measurement(vix, "index_points"), ust2y: measurement(4.05, "percent_yield"), ust10y: measurement(4.2, "percent_yield"),
    dxy: measurement(101.2, "index_points"), gold: measurement(2750, "USD_per_troy_ounce"), oil: measurement(71, "USD_per_barrel"),
    bitcoinOptional: null,
    marketChangePct: change,
    freshness: freshness(timestamp, stale),
    evidenceRefs: Object.freeze([
      evidence(`${name}.market.spy.${timestamp}`, "spy.value", spy, "USD", EvidenceType.DIRECT, timestamp, stale ? { isStale: true } : {}),
      evidence(`${name}.market.change.${timestamp}`, "marketChangePct", change, "percent", EvidenceType.DERIVED, timestamp, stale ? { isStale: true } : {}),
      evidence(`${name}.market.vix.${timestamp}`, "vix.value", vix, "index_points", EvidenceType.DIRECT, timestamp, stale ? { isStale: true } : {}),
    ]),
  });
}

function breadth(name, timestamp, strength, stale = false) {
  const advancers = Math.round(1500 + 700 * strength);
  const decliners = Math.round(1500 - 700 * strength);
  return Object.freeze({
    schemaVersion: SCHEMA_VERSION,
    snapshotId: `mock.pkg002.${name}.breadth.${timestamp}`,
    timestamp,
    sessionIdentity: SESSION_IDENTITY,
    venue: "US_COMPOSITE",
    advancers: measurement(advancers, "count"), decliners: measurement(decliners, "count"), unchanged: measurement(100, "count"),
    advancingVolume: measurement(1.5 + 0.8 * strength, "billion_shares"), decliningVolume: measurement(1.5 - 0.8 * strength, "billion_shares"),
    newHighs: measurement(Math.round(100 + 70 * strength), "count"), newLows: measurement(Math.round(100 - 70 * strength), "count"),
    pctAbove50DMA: measurement(50 + 25 * strength, "percent"), pctAbove200DMA: null,
    evidenceRefs: Object.freeze([
      evidence(`${name}.breadth.ad.${timestamp}`, "advanceDeclineParticipation", strength, "normalized", EvidenceType.DERIVED, timestamp, stale ? { isStale: true } : {}),
      evidence(`${name}.breadth.volume.${timestamp}`, "upDownVolumeParticipation", strength, "normalized", EvidenceType.PROXY, timestamp, stale ? { isStale: true } : {}),
    ]),
  });
}

function sector(name, timestamp, sectorId, strength, { priceOverride = null } = {}) {
  const price = priceOverride ?? strength * 1.2;
  const state = strength > 0.25 ? TrafficLight.GREEN : strength < -0.25 ? TrafficLight.RED : TrafficLight.ORANGE;
  return Object.freeze({
    schemaVersion: SCHEMA_VERSION,
    snapshotId: `mock.pkg002.${name}.sector.${sectorId}.${timestamp}`,
    timestamp,
    sessionIdentity: SESSION_IDENTITY,
    sectorId,
    benchmarkSymbol: sectorId === "TECHNOLOGY" ? "XLK" : sectorId === "FINANCIALS" ? "XLF" : "XLI",
    priceChangePct: measurement(price, "percent"),
    relativeStrengthVsSPY: measurement(strength * 0.8, "percentage_points"),
    relativeVolume: measurement(1 + strength * 0.5, "ratio"),
    breadthPctPositive: measurement(50 + strength * 35, "percent"),
    upDownVolumeRatio: measurement(1 + strength * 0.8, "ratio"),
    state,
    confidence: confidence(),
    evidenceRefs: Object.freeze([
      evidence(`${name}.sector.${sectorId}.price.${timestamp}`, "priceChangePct.value", price, "percent", EvidenceType.DIRECT, timestamp),
      evidence(`${name}.sector.${sectorId}.participation.${timestamp}`, "breadthPctPositive.value", 50 + strength * 35, "percent", EvidenceType.PROXY, timestamp),
    ]),
  });
}

function assetFlow(name, assetClass, value, { proxy = null, stale = false } = {}) {
  const isDirect = proxy === null;
  const id = `${name}.asset.${assetClass}.${isDirect ? "direct" : "proxy"}`;
  const flowSource = source(id, CURRENT, {
    latencyClass: isDirect ? "daily" : "realtime",
    isStale: stale,
    reportingPeriodStart: isDirect ? "2026-02-02T00:00:00.000Z" : null,
    reportingPeriodEnd: isDirect ? "2026-02-02T23:59:59.000Z" : null,
  });
  return Object.freeze({
    schemaVersion: SCHEMA_VERSION, snapshotId: `mock.pkg002.${id}`, timestamp: CURRENT, assetClass,
    flowValue: isDirect ? measurement(value, "USD_billions") : null,
    currency: isDirect ? "USD" : null, flowPeriod: isDirect ? "daily" : "intraday",
    flowType: isDirect ? EvidenceType.DIRECT : EvidenceType.PROXY,
    proxyState: proxy, methodologyId: `mock.pkg002.${isDirect ? "measured" : "proxy"}.v1`, confidence: confidence(stale ? 0.3 : 0.8),
    sourceMeta: flowSource,
    evidenceRefs: Object.freeze([{
      schemaVersion: SCHEMA_VERSION,
      evidenceId: `mock.pkg002.${id}.evidence`, sourceMeta: flowSource,
      field: isDirect ? "flowValue.value" : "participationProxy", value: isDirect ? value : proxy,
      unit: isDirect ? "USD_billions" : null, evidenceType: isDirect ? EvidenceType.DIRECT : EvidenceType.PROXY,
    }]),
  });
}

function country(name, countryOrRegion, horizon, states, { direct = null, latencyClass = "daily", stale = false } = {}) {
  const [proxyRotationState, fxState, sovereignBondState, relativeStrengthState] = states;
  const id = `${name}.country.${countryOrRegion}.${horizon}`.replaceAll(" ", "_");
  const refs = [evidence(`${id}.proxy`, "proxyRotationState", proxyRotationState, null, EvidenceType.PROXY, CURRENT)];
  if (direct !== null) refs.push(evidence(`${id}.direct`, "equityFlowValue.value", direct, "USD_millions", EvidenceType.DIRECT, CURRENT, { latencyClass, isStale: stale }));
  return Object.freeze({
    schemaVersion: SCHEMA_VERSION, snapshotId: `mock.pkg002.${id}`, timestamp: CURRENT, countryOrRegion, horizon,
    equityFlowValue: direct === null ? null : measurement(direct, "USD_millions"), bondFlowValue: null, directFlowAvailable: direct !== null,
    proxyRotationState, fxState, sovereignBondState, relativeStrengthState,
    compositeState: states.includes(TrafficLight.RED) && states.includes(TrafficLight.GREEN) ? TrafficLight.ORANGE : proxyRotationState,
    confidence: confidence(direct === null ? 0.6 : 0.8, direct === null ? ["Direct mock flow intentionally absent"] : []),
    evidenceRefs: Object.freeze(refs),
  });
}

function build(name, options = {}) {
  const momentum = options.momentum ?? 0.7;
  const breadthEnd = options.breadthEnd ?? momentum;
  const path = options.path ?? [-0.5, -0.15, 0.15, 0.4, momentum];
  const breadthPath = [...(options.breadthPath ?? path.map((item) => Math.max(-0.9, Math.min(0.9, item))))];
  breadthPath[breadthPath.length - 1] = breadthEnd;
  const marketSnapshots = options.missingHistory ? [market(name, CURRENT, 600, momentum, { vix: options.vix ?? 16, stale: options.stale, smallCapFactor: options.smallCapFactor ?? 1 })] : TIMES.map((timestamp, index) => market(name, timestamp, 596 + index, path[index], { vix: options.vix ?? 16, stale: options.stale && index === 4, smallCapFactor: index === 4 ? options.smallCapFactor ?? 1 : 1 }));
  const breadthSnapshots = options.missingHistory ? [breadth(name, CURRENT, breadthEnd, options.stale)] : TIMES.map((timestamp, index) => breadth(name, timestamp, breadthPath[index], options.stale && index === 4));
  const sectorStrengths = options.sectorStrengths ?? [breadthEnd, breadthEnd * 0.8, breadthEnd * 0.6];
  const sectorSnapshots = TIMES.flatMap((timestamp, timeIndex) => sectorStrengths.map((endStrength, sectorIndex) => {
    if (options.missingHistory && timeIndex !== TIMES.length - 1) return null;
    const sectorIds = ["TECHNOLOGY", "FINANCIALS", "INDUSTRIALS"];
    const historyStrength = timeIndex === TIMES.length - 1 ? endStrength : breadthPath[timeIndex] * (1 - sectorIndex * 0.1);
    const priceOverride = options.priceVolumeDivergence && timeIndex === TIMES.length - 1 ? 1.8 : null;
    return sector(name, timestamp, sectorIds[sectorIndex], historyStrength, { priceOverride });
  }).filter(Boolean));
  const assetFlowSnapshots = [
    assetFlow(name, "US_EQUITY", options.usEquityFlow ?? momentum),
    assetFlow(name, "US_BOND", options.usBondFlow ?? -momentum * 0.3),
    assetFlow(name, "MONEY_MARKET", options.moneyMarketFlow ?? -momentum * 0.2),
    assetFlow(name, "GOLD", options.goldFlow ?? -momentum * 0.1),
    ...(options.directProxyConflict ? [assetFlow(name, "US_EQUITY", null, { proxy: TrafficLight.RED })] : []),
  ];
  const countryStates = options.countryStates ?? (momentum >= 0 ? [TrafficLight.GREEN, TrafficLight.GREEN, TrafficLight.ORANGE, TrafficLight.GREEN] : [TrafficLight.RED, TrafficLight.RED, TrafficLight.ORANGE, TrafficLight.RED]);
  const countryFlowSnapshots = options.insufficientCountry ? [country(name, "Brazil", "1d", [TrafficLight.GREY, TrafficLight.GREY, TrafficLight.GREY, TrafficLight.GREY])] : [
    country(name, "United States", options.countryHorizon ?? "1d", countryStates, { direct: options.countryDirect ?? momentum * 500, latencyClass: options.countryLatency ?? "daily" }),
    country(name, "Japan", "1d", [TrafficLight.GREEN, TrafficLight.GREEN, TrafficLight.ORANGE, TrafficLight.GREEN]),
  ];
  return deepFreeze({ scenarioId: name, notice: MOCK_DATA_NOTICE, evaluatedAt: CURRENT, sessionStartTimestamp: SESSION_START, marketSnapshots, breadthSnapshots, sectorSnapshots, assetFlowSnapshots, countryFlowSnapshots });
}

export const MARKET_CONTEXT_SCENARIOS = deepFreeze({
  BROAD_RISK_ON: build("BROAD_RISK_ON"),
  BROAD_RISK_OFF: build("BROAD_RISK_OFF", { momentum: -0.75, breadthEnd: -0.8, vix: 29 }),
  MEGACAP_CONCENTRATED: build("MEGACAP_CONCENTRATED", { momentum: 0.65, breadthEnd: -0.55, smallCapFactor: 0.97, sectorStrengths: [0.85, -0.55, -0.65] }),
  PRICE_VOLUME_DIVERGENCE: build("PRICE_VOLUME_DIVERGENCE", { momentum: 0.45, breadthEnd: -0.7, priceVolumeDivergence: true, sectorStrengths: [-0.7, -0.6, -0.5] }),
  BREADTH_RECOVERY: build("BREADTH_RECOVERY", { momentum: 0.2, breadthEnd: 0.2, path: [0.8, -0.8, -0.6, -0.3, 0.2], breadthPath: [0.8, -0.8, -0.6, -0.3, 0.2] }),
  LATE_SESSION_DETERIORATION: build("LATE_SESSION_DETERIORATION", { momentum: -0.6, path: [0.2, 0.55, 0.45, 0.25, -0.6], breadthPath: [0.3, 0.65, 0.5, 0.2, -0.75] }),
  STALE_DATA: build("STALE_DATA", { stale: true }),
  MISSING_HISTORY: build("MISSING_HISTORY", { missingHistory: true }),
  GLOBAL_US_DISAGREEMENT: build("GLOBAL_US_DISAGREEMENT", { momentum: -0.6, breadthEnd: -0.7, vix: 27, countryStates: [TrafficLight.GREEN, TrafficLight.GREEN, TrafficLight.ORANGE, TrafficLight.GREEN], countryDirect: 500 }),
  DIRECT_PROXY_CONFLICT: build("DIRECT_PROXY_CONFLICT", { directProxyConflict: true, usEquityFlow: 0.9 }),
  STRUCTURAL_VS_OVERNIGHT: build("STRUCTURAL_VS_OVERNIGHT", { countryHorizon: "overnight", countryLatency: "monthly", countryDirect: 800, countryStates: [TrafficLight.RED, TrafficLight.RED, TrafficLight.ORANGE, TrafficLight.RED] }),
  INSUFFICIENT_COUNTRY_DATA: build("INSUFFICIENT_COUNTRY_DATA", { insufficientCountry: true }),
});
