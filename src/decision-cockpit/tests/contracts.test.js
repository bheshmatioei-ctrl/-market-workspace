import test from "node:test";
import assert from "node:assert/strict";
import {
  discoveredStocks,
  focusStocks,
  globalCapitalRotationState,
  marketDecisionState,
  mockConfidence,
  mockEvidence,
  mockFreshness,
  mockSource,
  measurement,
  predictionRecordFixture,
  premarketSnapshot,
  proxyAssetFlow,
  constructiveMarketSnapshot,
  directAssetFlow,
} from "../mocks/fixtures.js";
import { deterministicSerialize, deserializeContract } from "../contracts/serialization.js";
import { ContractValidationError, supportedContractNames, validateContract } from "../contracts/validators.js";
import { EvidenceType, SCHEMA_VERSION, TrafficLight } from "../domain/constants.js";

const timestamp = "2026-01-15T15:00:00.000Z";
const evidence = mockEvidence({ id: "test.evidence", field: "test", value: 1, unit: "ratio" });

const breadth = {
  schemaVersion: SCHEMA_VERSION,
  snapshotId: "test.breadth",
  timestamp,
  venue: "NASDAQ",
  advancers: measurement(1800, "count"), decliners: measurement(1200, "count"), unchanged: measurement(100, "count"),
  advancingVolume: measurement(2.1, "billion_shares"), decliningVolume: measurement(1.4, "billion_shares"),
  newHighs: measurement(150, "count"), newLows: measurement(60, "count"),
  pctAbove50DMA: measurement(61, "percent"), pctAbove200DMA: null,
  evidenceRefs: [evidence],
};

const sector = {
  schemaVersion: SCHEMA_VERSION,
  snapshotId: "test.sector",
  timestamp,
  sectorId: "TECHNOLOGY",
  benchmarkSymbol: "XLK",
  priceChangePct: measurement(1.2, "percent"),
  relativeStrengthVsSPY: measurement(0.5, "percentage_points"),
  relativeVolume: measurement(1.3, "ratio"),
  breadthPctPositive: null,
  upDownVolumeRatio: null,
  state: TrafficLight.GREEN,
  confidence: mockConfidence(0.8, ["Test fixture"]),
  evidenceRefs: [evidence],
};

const catalyst = {
  schemaVersion: SCHEMA_VERSION,
  eventId: "test.event",
  timestamp,
  eventType: "macro",
  scheduled: true,
  scheduledAt: "2026-01-15T15:30:00.000Z",
  sourceMeta: mockSource(),
  headline: "MOCK scheduled release",
  summary: "MOCK only",
  affectedSymbols: [],
  affectedSectors: ["US_MARKET"],
  factualImpact: "Not released",
  marketReaction: null,
  interpretation: null,
  confidence: mockConfidence(0.7, ["Test fixture"]),
};

const alert = {
  schemaVersion: SCHEMA_VERSION,
  alertId: "test.alert",
  createdAt: timestamp,
  type: "MOCK_ANOMALY",
  severity: "watch",
  symbol: "NVDA",
  sector: "TECHNOLOGY",
  marketWide: false,
  rawEvidence: [evidence],
  interpretation: "MOCK test-only interpretation",
  trafficLight: TrafficLight.ORANGE,
  confidence: mockConfidence(0.6, ["Test fixture"]),
  expiresAt: null,
  modelVersion: "test.v1",
};

const zone = {
  schemaVersion: SCHEMA_VERSION,
  zoneId: "test.zone",
  createdAt: timestamp,
  symbol: "NVDA",
  zoneType: "CONDITIONAL",
  lowPrice: measurement(139, "USD"),
  highPrice: measurement(141, "USD"),
  validFrom: timestamp,
  validUntil: "2026-01-15T16:00:00.000Z",
  conditions: ["MOCK condition"],
  invalidationConditions: ["MOCK invalidation"],
  confidence: mockConfidence(0.5, ["Storage contract only"]),
  engineVersion: "test.v1",
};

const outcome = {
  schemaVersion: SCHEMA_VERSION,
  predictionId: predictionRecordFixture.predictionId,
  evaluatedAt: "2026-01-15T16:00:00.000Z",
  actualMovePct: -0.4,
  actualDirection: "DOWN",
  maxFavorableExcursionPct: 0.1,
  maxAdverseExcursionPct: -0.7,
  magnitudeError: null,
  pass: false,
  evaluationRuleVersion: "test.rule.v1",
};

const contractFixtures = {
  MarketSnapshot: constructiveMarketSnapshot,
  BreadthSnapshot: breadth,
  SectorSnapshot: sector,
  StockSnapshot: focusStocks[0],
  AssetFlowSnapshot: directAssetFlow,
  CountryFlowSnapshot: globalCapitalRotationState[0],
  PremarketSnapshot: premarketSnapshot,
  CatalystEvent: catalyst,
  Alert: alert,
  DecisionState: marketDecisionState,
  TradeDecisionZone: zone,
  PredictionRecord: predictionRecordFixture,
  PredictionOutcome: outcome,
};

test("all required normalized contracts are runtime-validatable and deterministic", () => {
  assert.equal(Object.keys(contractFixtures).every((name) => supportedContractNames.includes(name)), true);
  for (const [name, fixture] of Object.entries(contractFixtures)) {
    validateContract(name, fixture);
    const serialized = deterministicSerialize(name, fixture);
    const roundTrip = deserializeContract(name, serialized);
    assert.equal(deterministicSerialize(name, roundTrip), serialized, `${name} round-trip must be deterministic`);
    assert.equal(roundTrip.schemaVersion, SCHEMA_VERSION);
  }
});

test("schemaVersion is mandatory at the serialization boundary", () => {
  const missingVersion = structuredClone(constructiveMarketSnapshot);
  delete missingVersion.schemaVersion;
  assert.throws(() => deterministicSerialize("MarketSnapshot", missingVersion), ContractValidationError);
});

test("explicit missing measurements require a reason", () => {
  const invalid = structuredClone(constructiveMarketSnapshot);
  invalid.spy = { value: null, unit: "USD", missingReason: null };
  assert.throws(() => validateContract("MarketSnapshot", invalid), /missingReason/);
});

test("DIRECT and PROXY flows cannot be silently conflated", () => {
  validateContract("AssetFlowSnapshot", directAssetFlow);
  validateContract("AssetFlowSnapshot", proxyAssetFlow);
  const invalidProxy = structuredClone(proxyAssetFlow);
  invalidProxy.flowValue = measurement(2.5, "USD_billions");
  assert.throws(() => validateContract("AssetFlowSnapshot", invalidProxy), /PROXY flowValue must be null/);

  const invalidDirect = structuredClone(directAssetFlow);
  invalidDirect.flowType = EvidenceType.PROXY;
  assert.throws(() => validateContract("AssetFlowSnapshot", invalidDirect), /PROXY flowValue must be null/);
});

test("My Focus and AI Discovered fixtures remain separate five-name collections", () => {
  assert.equal(focusStocks.length, 5);
  assert.equal(discoveredStocks.length, 5);
  const focusIds = new Set(focusStocks.map((stock) => stock.snapshotId));
  assert.equal(discoveredStocks.some((stock) => focusIds.has(stock.snapshotId)), false);
});
