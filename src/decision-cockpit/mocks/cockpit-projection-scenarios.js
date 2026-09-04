import { evaluateAnomalyRadar } from "../engines/anomaly-radar-engine.js";
import { evaluateGlobalCapitalRotation } from "../engines/global-capital-rotation-engine.js";
import { evaluateMarketDirection } from "../engines/market-direction-engine.js";
import { evaluateMarketRegime } from "../engines/market-regime-engine.js";
import { evaluateSectorMoneyFlow } from "../engines/money-flow-engine.js";
import { evaluatePremarketIntelligence } from "../engines/premarket-intelligence-engine.js";
import { evaluateUSAssetFlows } from "../engines/us-asset-flow-monitor.js";
import { ANOMALY_RADAR_SCENARIOS } from "./anomaly-radar-scenarios.js";
import { MARKET_CONTEXT_SCENARIOS } from "./market-context-scenarios.js";
import { PREMARKET_INTELLIGENCE_SCENARIOS } from "./premarket-intelligence-scenarios.js";
import { HistoricalSnapshotWindow } from "../state/historical-snapshot-window.js";

export const COCKPIT_MOCK_DATA_NOTICE = "MOCK / TEST DATA ONLY — NOT LIVE MARKET DATA";
export const COCKPIT_GENERATED_AT = "2026-01-15T15:00:00.000Z";

function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value).forEach(deepFreeze);
  }
  return value;
}

function marketOutputs(scenario) {
  const currentMarket = scenario.marketSnapshots.at(-1);
  const currentBreadth = scenario.breadthSnapshots.at(-1);
  const currentSectors = scenario.sectorSnapshots.filter((item) => item.timestamp === scenario.evaluatedAt);
  const history = new HistoricalSnapshotWindow();
  scenario.marketSnapshots.forEach((item) => history.append("MarketSnapshot", "US_MARKET", item));
  scenario.breadthSnapshots.forEach((item) => history.append("BreadthSnapshot", item.venue, item));
  scenario.sectorSnapshots.forEach((item) => history.append("SectorSnapshot", item.sectorId, item));
  const assetFlow = evaluateUSAssetFlows({ assetFlowSnapshots: scenario.assetFlowSnapshots, evaluatedAt: scenario.evaluatedAt });
  const flow = evaluateSectorMoneyFlow({ sectorSnapshots: currentSectors, assetFlowSnapshots: scenario.assetFlowSnapshots, evaluatedAt: scenario.evaluatedAt });
  const global = evaluateGlobalCapitalRotation({ countryFlowSnapshots: scenario.countryFlowSnapshots, evaluatedAt: scenario.evaluatedAt });
  const regime = evaluateMarketRegime({ marketSnapshot: currentMarket, breadthSnapshot: currentBreadth, sectorSnapshots: currentSectors, assetFlowSnapshots: scenario.assetFlowSnapshots, assetFlowAssessments: assetFlow, globalRotationAssessments: global, evaluatedAt: scenario.evaluatedAt });
  const directions = evaluateMarketDirection({ marketSnapshot: currentMarket, breadthSnapshot: currentBreadth, sectorSnapshots: currentSectors, historicalWindow: history, evaluatedAt: scenario.evaluatedAt, sessionStartTimestamp: scenario.sessionStartTimestamp });
  return { regime, directions, flows: [...flow, ...assetFlow], global };
}

const constructive = marketOutputs(MARKET_CONTEXT_SCENARIOS.BROAD_RISK_ON);
const riskOff = marketOutputs(MARKET_CONTEXT_SCENARIOS.BROAD_RISK_OFF);
const conflicted = marketOutputs(MARKET_CONTEXT_SCENARIOS.DIRECT_PROXY_CONFLICT);
const stale = marketOutputs(MARKET_CONTEXT_SCENARIOS.STALE_DATA);
const proxyOnlyAsset = evaluateUSAssetFlows({
  assetFlowSnapshots: MARKET_CONTEXT_SCENARIOS.DIRECT_PROXY_CONFLICT.assetFlowSnapshots.filter((item) => item.flowType === "PROXY"),
  evaluatedAt: MARKET_CONTEXT_SCENARIOS.DIRECT_PROXY_CONFLICT.evaluatedAt,
});
const livePremarket = evaluatePremarketIntelligence(PREMARKET_INTELLIGENCE_SCENARIOS.ALL_CONSTRUCTIVE);
const frozenPremarket = evaluatePremarketIntelligence(PREMARKET_INTELLIGENCE_SCENARIOS.FREEZE_AT_OPEN);
const reversalPremarket = evaluatePremarketIntelligence(PREMARKET_INTELLIGENCE_SCENARIOS.OVERNIGHT_TO_PREMARKET_REVERSAL);
const anomaly = evaluateAnomalyRadar(ANOMALY_RADAR_SCENARIOS.DETERMINISTIC_ORDERING);
const multipleAnomaly = evaluateAnomalyRadar(ANOMALY_RADAR_SCENARIOS.MULTIPLE_ANOMALIES_SAME_SYMBOL);

function input(overrides = {}) {
  return {
    generatedAt: COCKPIT_GENERATED_AT,
    decisionState: constructive.regime,
    directionAssessments: constructive.directions,
    flowAssessments: constructive.flows,
    globalRotationAssessments: constructive.global,
    alerts: anomaly.alerts,
    discoveryCandidates: anomaly.discoveryCandidates,
    premarketSnapshot: livePremarket,
    premarketWindowAssessments: livePremarket.windowAssessments,
    ...overrides,
  };
}

function scenario(name, overrides = {}) {
  return { name, notice: COCKPIT_MOCK_DATA_NOTICE, input: input(overrides) };
}

export const COCKPIT_PROJECTION_SCENARIOS = deepFreeze({
  CONSTRUCTIVE_MARKET: scenario("CONSTRUCTIVE_MARKET"),
  RISK_OFF_MARKET: scenario("RISK_OFF_MARKET", { decisionState: riskOff.regime, directionAssessments: riskOff.directions, flowAssessments: riskOff.flows }),
  CONFLICTED_MARKET: scenario("CONFLICTED_MARKET", { decisionState: conflicted.regime, flowAssessments: conflicted.flows }),
  STALE_MARKET: scenario("STALE_MARKET", { decisionState: stale.regime, directionAssessments: stale.directions, flowAssessments: stale.flows }),
  MISSING_MARKET_CONTEXT: scenario("MISSING_MARKET_CONTEXT", { decisionState: null, directionAssessments: [], flowAssessments: [] }),
  PREMARKET_LIVE: scenario("PREMARKET_LIVE", { premarketSnapshot: livePremarket, premarketWindowAssessments: livePremarket.windowAssessments }),
  PREMARKET_FROZEN: scenario("PREMARKET_FROZEN", { premarketSnapshot: frozenPremarket, premarketWindowAssessments: frozenPremarket.windowAssessments }),
  PREMARKET_REVERSAL: scenario("PREMARKET_REVERSAL", { premarketSnapshot: reversalPremarket, premarketWindowAssessments: reversalPremarket.windowAssessments }),
  DIRECT_FLOW_AVAILABLE: scenario("DIRECT_FLOW_AVAILABLE", { flowAssessments: constructive.flows.filter((item) => item.flowMode === "DIRECT") }),
  PROXY_ONLY_FLOW: scenario("PROXY_ONLY_FLOW", { flowAssessments: proxyOnlyAsset }),
  DIRECT_PROXY_CONFLICT: scenario("DIRECT_PROXY_CONFLICT", { flowAssessments: conflicted.flows }),
  GLOBAL_POSITIVE: scenario("GLOBAL_POSITIVE", { globalRotationAssessments: constructive.global.filter((item) => item.state === "POSITIVE_ROTATION") }),
  GLOBAL_NEGATIVE: scenario("GLOBAL_NEGATIVE", { globalRotationAssessments: riskOff.global }),
  GLOBAL_MIXED_HORIZONS: scenario("GLOBAL_MIXED_HORIZONS", { globalRotationAssessments: [...constructive.global, ...marketOutputs(MARKET_CONTEXT_SCENARIOS.STRUCTURAL_VS_OVERNIGHT).global] }),
  ALERT_STREAM: scenario("ALERT_STREAM", { alerts: anomaly.alerts }),
  MULTIPLE_DISCOVERY_CANDIDATES: scenario("MULTIPLE_DISCOVERY_CANDIDATES", { discoveryCandidates: [...anomaly.discoveryCandidates, ...multipleAnomaly.discoveryCandidates] }),
  SHADOW_LIFECYCLE_VISIBILITY: scenario("SHADOW_LIFECYCLE_VISIBILITY"),
  STALE_TO_GREY: scenario("STALE_TO_GREY", { decisionState: stale.regime, directionAssessments: stale.directions }),
  CONFLICT_EVIDENCE_VISIBLE: scenario("CONFLICT_EVIDENCE_VISIBLE", { decisionState: conflicted.regime, flowAssessments: conflicted.flows }),
  DETERMINISTIC_PROJECTION: scenario("DETERMINISTIC_PROJECTION", {
    directionAssessments: [...constructive.directions].reverse(),
    flowAssessments: [...constructive.flows].reverse(),
    globalRotationAssessments: [...constructive.global].reverse(),
    alerts: [...anomaly.alerts].reverse(),
    discoveryCandidates: [...anomaly.discoveryCandidates].reverse(),
    premarketWindowAssessments: [...livePremarket.windowAssessments].reverse(),
  }),
});
