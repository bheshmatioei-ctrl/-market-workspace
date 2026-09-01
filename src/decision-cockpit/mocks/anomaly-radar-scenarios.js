import {
  EvidenceType,
  FreshnessStatus,
  SCHEMA_VERSION,
  TrafficLight,
} from "../domain/constants.js";
import { mockConfidence, mockEvidence, mockFreshness, mockSource } from "./fixtures.js";

export const ANOMALY_MOCK_DATA_NOTICE = "MOCK / TEST DATA ONLY — NOT LIVE MARKET DATA";
export const ANOMALY_EVALUATED_AT = "2026-01-15T15:00:00.000Z";
const PRIOR_TIME = "2026-01-15T14:55:00.000Z";

function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value).forEach(deepFreeze);
  }
  return value;
}

function measurement(value, unit, missingReason = null) {
  return { value, unit, missingReason: value === null ? missingReason ?? "MOCK value intentionally unavailable." : null };
}

function sourceFor(id, timestamp, overrides = {}) {
  return mockSource({
    sourceId: `mock.anomaly.${id}`,
    sourceName: ANOMALY_MOCK_DATA_NOTICE,
    observedAt: timestamp,
    receivedAt: timestamp,
    ...overrides,
  });
}

const STOCK_UNITS = Object.freeze({
  price: "USD",
  priorClose: "USD",
  changePct: "percent",
  volume: "shares",
  avgVolume: "shares_per_session",
  relativeVolume: "ratio",
  dollarVolume: "USD",
  vwap: "USD",
  distanceFromVWAPPct: "percent",
  dayHigh: "USD",
  dayLow: "USD",
  relativeStrengthVsBenchmark: "percentage_points",
});

export function anomalyStockFixture({
  id,
  symbol = "MOCK",
  timestamp = ANOMALY_EVALUATED_AT,
  price = 100,
  priorClose = 100,
  changePct = 0,
  volume = 100_000,
  avgVolume = 100_000,
  relativeVolume = 1,
  dollarVolume = 10_000_000,
  vwap = 100,
  distanceFromVWAPPct = 0,
  dayHigh = 101,
  dayLow = 99,
  relativeStrengthVsBenchmark = 0,
  sectorId = "TECHNOLOGY",
  freshness = mockFreshness(),
  sourceOverrides = {},
  extraEvidence = [],
} = {}) {
  const source = sourceFor(`stock.${id}`, timestamp, sourceOverrides);
  const values = { price, priorClose, changePct, volume, avgVolume, relativeVolume, dollarVolume, vwap, distanceFromVWAPPct, dayHigh, dayLow, relativeStrengthVsBenchmark };
  const evidenceRefs = Object.entries(values)
    .filter(([, value]) => value !== null)
    .map(([field, value]) => mockEvidence({
      id: `mock.anomaly.stock.${id}.${field}`,
      field: `${field}.value`,
      value,
      unit: STOCK_UNITS[field],
      type: EvidenceType.DIRECT,
      source,
    }));
  return deepFreeze({
    schemaVersion: SCHEMA_VERSION,
    snapshotId: `mock.anomaly.stock.${id}`,
    timestamp,
    symbol,
    ...Object.fromEntries(Object.entries(values).map(([field, value]) => [field, measurement(value, STOCK_UNITS[field])])),
    sectorId,
    newsEventIds: [],
    freshness,
    evidenceRefs: [...evidenceRefs, ...extraEvidence],
    mockDataNotice: ANOMALY_MOCK_DATA_NOTICE,
  });
}

export function anomalySectorFixture({
  id,
  timestamp = ANOMALY_EVALUATED_AT,
  sectorId = "TECHNOLOGY",
  priceChangePct = 0.8,
  relativeStrengthVsSPY = 0.4,
  relativeVolume = 1.1,
  stale = false,
} = {}) {
  const source = sourceFor(`sector.${id}`, timestamp, { isStale: stale });
  const evidenceRefs = [
    mockEvidence({ id: `mock.anomaly.sector.${id}.priceChangePct`, field: "priceChangePct.value", value: priceChangePct, unit: "percent", source }),
    mockEvidence({ id: `mock.anomaly.sector.${id}.relativeStrengthVsSPY`, field: "relativeStrengthVsSPY.value", value: relativeStrengthVsSPY, unit: "percentage_points", source }),
    mockEvidence({ id: `mock.anomaly.sector.${id}.relativeVolume`, field: "relativeVolume.value", value: relativeVolume, unit: "ratio", source }),
  ];
  return deepFreeze({
    schemaVersion: SCHEMA_VERSION,
    snapshotId: `mock.anomaly.sector.${id}`,
    timestamp,
    sectorId,
    benchmarkSymbol: "MOCK-XLK",
    priceChangePct: measurement(priceChangePct, "percent"),
    relativeStrengthVsSPY: measurement(relativeStrengthVsSPY, "percentage_points"),
    relativeVolume: measurement(relativeVolume, "ratio"),
    breadthPctPositive: null,
    upDownVolumeRatio: null,
    state: priceChangePct > 0 ? TrafficLight.GREEN : priceChangePct < 0 ? TrafficLight.RED : TrafficLight.ORANGE,
    confidence: mockConfidence(stale ? 0.2 : 0.8, [ANOMALY_MOCK_DATA_NOTICE], stale ? ["MOCK sector source is intentionally stale."] : []),
    evidenceRefs,
    mockDataNotice: ANOMALY_MOCK_DATA_NOTICE,
  });
}

export function anomalyCatalystFixture({
  id,
  timestamp = "2026-01-15T14:58:00.000Z",
  symbol = "MOCK",
  sectorId = "TECHNOLOGY",
  scheduled = false,
  scheduledAt = null,
  sourceOverrides = {},
} = {}) {
  return deepFreeze({
    schemaVersion: SCHEMA_VERSION,
    eventId: `mock.anomaly.event.${id}`,
    timestamp,
    eventType: "other",
    scheduled,
    scheduledAt,
    sourceMeta: sourceFor(`event.${id}`, timestamp, sourceOverrides),
    headline: "MOCK anomaly-associated catalyst",
    summary: ANOMALY_MOCK_DATA_NOTICE,
    affectedSymbols: [symbol],
    affectedSectors: [sectorId],
    factualImpact: "MOCK factual event association only; causation is not asserted.",
    marketReaction: null,
    interpretation: null,
    confidence: mockConfidence(0.75, [ANOMALY_MOCK_DATA_NOTICE]),
    mockDataNotice: ANOMALY_MOCK_DATA_NOTICE,
  });
}

function prior(id, symbol = "MOCK", overrides = {}) {
  return anomalyStockFixture({ id: `${id}.prior`, symbol, timestamp: PRIOR_TIME, ...overrides });
}

function current(id, symbol = "MOCK", overrides = {}) {
  return anomalyStockFixture({ id: `${id}.current`, symbol, ...overrides });
}

function scenario(name, stockSnapshots, sectorSnapshots = [], catalystEvents = []) {
  return deepFreeze({
    name,
    notice: ANOMALY_MOCK_DATA_NOTICE,
    evaluatedAt: ANOMALY_EVALUATED_AT,
    stockSnapshots,
    sectorSnapshots,
    catalystEvents,
  });
}

const rvol = current("rvol", "RVOL", { relativeVolume: 2.5, changePct: 0.8 });
const abnormalDollar = current("dollar", "DOLLAR", { dollarVolume: 90_000_000, changePct: 0.8 });
const gapUp = current("gap-up", "GAPUP", { price: 103, priorClose: 100, changePct: 3, vwap: 103, dayHigh: 104 });
const gapDown = current("gap-down", "GAPDOWN", { price: 97, priorClose: 100, changePct: -3, vwap: 97, dayLow: 96 });
const reclaimPrior = prior("reclaim", "RECLAIM", { price: 99, vwap: 100, dayHigh: 102, dayLow: 98 });
const reclaimCurrent = current("reclaim", "RECLAIM", { price: 100.5, priorClose: 100, changePct: 0.5, vwap: 100, distanceFromVWAPPct: 0.5 });
const breakdownPrior = prior("vwap-break", "VWAPBREAK", { price: 101, vwap: 100, dayHigh: 102, dayLow: 98 });
const breakdownCurrent = current("vwap-break", "VWAPBREAK", { price: 99.5, priorClose: 100, changePct: -0.5, vwap: 100, distanceFromVWAPPct: -0.5 });
const breakoutPrior = prior("breakout", "BREAKOUT", { dayHigh: 101, dayLow: 99 });
const breakoutCurrent = current("breakout", "BREAKOUT", { price: 102, priorClose: 101.8, changePct: 0.2, vwap: 102, dayHigh: 102.5 });
const priceBreakdownPrior = prior("breakdown", "BREAKDOWN", { dayHigh: 101, dayLow: 99 });
const priceBreakdownCurrent = current("breakdown", "BREAKDOWN", { price: 98, priorClose: 98.2, changePct: -0.2, vwap: 98, dayLow: 97.5 });
const rsUpPrior = prior("rs-up", "RSUP", { relativeStrengthVsBenchmark: -0.2 });
const rsUpCurrent = current("rs-up", "RSUP", { relativeStrengthVsBenchmark: 0.4 });
const rsDownPrior = prior("rs-down", "RSDOWN", { relativeStrengthVsBenchmark: 0.4 });
const rsDownCurrent = current("rs-down", "RSDOWN", { relativeStrengthVsBenchmark: -0.2 });
const divergence = current("price-volume", "PVDIV", { relativeVolume: 3, changePct: 0.1 });
const sectorConfirmStock = current("sector-confirm", "SECCONF", { price: 101, priorClose: 100, changePct: 1 });
const sectorConfirm = anomalySectorFixture({ id: "confirm", priceChangePct: 0.8 });
const sectorDivergeStock = current("sector-diverge", "SECDIV", { price: 101, priorClose: 100, changePct: 1 });
const sectorDiverge = anomalySectorFixture({ id: "diverge", priceChangePct: -0.8 });
const catalystMove = current("catalyst", "CATALYST", { price: 103, priorClose: 100, changePct: 3, vwap: 103, dayHigh: 104 });
const catalyst = anomalyCatalystFixture({ id: "associated", symbol: "CATALYST" });
const noCatalystMove = current("no-catalyst", "NOCAT", { price: 103, priorClose: 100, changePct: 3, vwap: 103, dayHigh: 104 });
const staleStock = current("stale", "STALE", { relativeVolume: 3, freshness: mockFreshness(FreshnessStatus.STALE, 1_000, "MOCK stock data is intentionally stale.") });
const missingVolume = current("missing-volume", "MISSVOL", { volume: null, avgVolume: null, relativeVolume: null, dollarVolume: null });
const missingSector = current("missing-sector", "MISSSEC", { relativeVolume: 2.5, changePct: 0.8 });
const futureStock = current("future", "FUTURE", { timestamp: "2026-01-15T15:05:00.000Z", relativeVolume: 3 });
const multiPrior = prior("multiple", "MULTI", { price: 99, vwap: 100, dayHigh: 102, dayLow: 98, relativeStrengthVsBenchmark: 0 });
const multiCurrent = current("multiple", "MULTI", { price: 105, priorClose: 100, changePct: 5, volume: 3_000_000, avgVolume: 1_000_000, relativeVolume: 3, dollarVolume: 315_000_000, vwap: 103, distanceFromVWAPPct: 1.94, dayHigh: 106, relativeStrengthVsBenchmark: 1 });
const multiSector = anomalySectorFixture({ id: "multiple", priceChangePct: -0.8 });
const multiCatalyst = anomalyCatalystFixture({ id: "multiple", symbol: "MULTI" });
const duplicateStock = current("duplicate", "DUP", { price: 103, priorClose: 100, changePct: 3, vwap: 103, dayHigh: 104 });
const orderingA = current("ordering-a", "AAA", { price: 103, priorClose: 100, changePct: 3, vwap: 103, dayHigh: 104 });
const orderingZ = current("ordering-z", "ZZZ", { price: 97, priorClose: 100, changePct: -3, vwap: 97, dayLow: 96 });

export const ANOMALY_RADAR_SCENARIOS = deepFreeze({
  RVOL_SPIKE: scenario("RVOL_SPIKE", [rvol]),
  ABNORMAL_DOLLAR_VOLUME: scenario("ABNORMAL_DOLLAR_VOLUME", [abnormalDollar]),
  GAP_UP_CONFIRMED: scenario("GAP_UP_CONFIRMED", [gapUp]),
  GAP_DOWN_CONFIRMED: scenario("GAP_DOWN_CONFIRMED", [gapDown]),
  VWAP_RECLAIM: scenario("VWAP_RECLAIM", [reclaimPrior, reclaimCurrent]),
  VWAP_BREAKDOWN: scenario("VWAP_BREAKDOWN", [breakdownPrior, breakdownCurrent]),
  BREAKOUT_CONFIRMED: scenario("BREAKOUT_CONFIRMED", [breakoutPrior, breakoutCurrent]),
  BREAKDOWN_CONFIRMED: scenario("BREAKDOWN_CONFIRMED", [priceBreakdownPrior, priceBreakdownCurrent]),
  RELATIVE_STRENGTH_ACCELERATION: scenario("RELATIVE_STRENGTH_ACCELERATION", [rsUpPrior, rsUpCurrent]),
  RELATIVE_STRENGTH_DETERIORATION: scenario("RELATIVE_STRENGTH_DETERIORATION", [rsDownPrior, rsDownCurrent]),
  PRICE_VOLUME_DIVERGENCE: scenario("PRICE_VOLUME_DIVERGENCE", [divergence]),
  SECTOR_CONFIRMATION: scenario("SECTOR_CONFIRMATION", [sectorConfirmStock], [sectorConfirm]),
  SECTOR_DIVERGENCE: scenario("SECTOR_DIVERGENCE", [sectorDivergeStock], [sectorDiverge]),
  CATALYST_ASSOCIATED_MOVE: scenario("CATALYST_ASSOCIATED_MOVE", [catalystMove], [], [catalyst]),
  ABNORMAL_MOVE_WITHOUT_CATALYST: scenario("ABNORMAL_MOVE_WITHOUT_CATALYST", [noCatalystMove]),
  STALE_STOCK_DATA: scenario("STALE_STOCK_DATA", [staleStock]),
  MISSING_VOLUME: scenario("MISSING_VOLUME", [missingVolume]),
  MISSING_SECTOR_CONTEXT: scenario("MISSING_SECTOR_CONTEXT", [missingSector]),
  FUTURE_SNAPSHOT_REJECTION: scenario("FUTURE_SNAPSHOT_REJECTION", [futureStock]),
  MULTIPLE_ANOMALIES_SAME_SYMBOL: scenario("MULTIPLE_ANOMALIES_SAME_SYMBOL", [multiPrior, multiCurrent], [multiSector], [multiCatalyst]),
  DUPLICATE_ALERT_PREVENTION: scenario("DUPLICATE_ALERT_PREVENTION", [duplicateStock, duplicateStock]),
  DETERMINISTIC_ORDERING: scenario("DETERMINISTIC_ORDERING", [orderingZ, orderingA]),
});
