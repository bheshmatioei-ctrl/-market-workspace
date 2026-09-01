import test from "node:test";
import assert from "node:assert/strict";
import { deterministicSerialize } from "../contracts/serialization.js";
import { validateContract } from "../contracts/validators.js";
import { DirectionState, FlowMode, FlowState, TrafficLight } from "../domain/constants.js";
import { evaluateMarketDirection } from "../engines/market-direction-engine.js";
import { evaluateMarketRegime } from "../engines/market-regime-engine.js";
import { evaluateUSAssetFlows } from "../engines/us-asset-flow-monitor.js";
import { MARKET_CONTEXT_SCENARIOS } from "../mocks/market-context-scenarios.js";
import { HistoricalSnapshotWindow, HistoricalWindowResult } from "../state/historical-snapshot-window.js";

const RISK_ON = MARKET_CONTEXT_SCENARIOS.BROAD_RISK_ON;
const CURRENT = "2026-02-03T20:00:00.000Z";
const TARGET = "2026-02-03T19:30:00.000Z";

function atTimestamp(snapshot, suffix, timestamp) {
  const copy = structuredClone(snapshot);
  copy.snapshotId = `mock.remediation.${suffix}`;
  copy.timestamp = timestamp;
  return copy;
}

function marketHistoryResult(candidates, options = { minutes: 30, toleranceSeconds: 600 }) {
  const current = atTimestamp(RISK_ON.marketSnapshots.at(-1), "market.current", CURRENT);
  const window = new HistoricalSnapshotWindow({ outOfOrderPolicy: "SORT" });
  candidates.forEach((candidate) => window.append("MarketSnapshot", "US_MARKET", candidate));
  window.append("MarketSnapshot", "US_MARKET", current);
  return window.comparisonFor("MarketSnapshot", "US_MARKET", current, options);
}

function candidateFor(contractName, current, suffix, identityOverrides = {}) {
  const candidate = atTimestamp(current, suffix, TARGET);
  candidate.sessionIdentity = { ...candidate.sessionIdentity, ...identityOverrides };
  if (contractName === "MarketSnapshot") {
    candidate.sessionDate = candidate.sessionIdentity.sessionDate;
    candidate.sessionPhase = candidate.sessionIdentity.sessionPhase;
  }
  return candidate;
}

function comparisonForContract(contractName, scopeId, current, candidate) {
  const window = new HistoricalSnapshotWindow({ outOfOrderPolicy: "SORT" });
  window.append(contractName, scopeId, candidate).append(contractName, scopeId, current);
  return window.comparisonFor(contractName, scopeId, current, { minutes: 30, toleranceSeconds: 600 });
}

function equityAssessment(snapshots) {
  return evaluateUSAssetFlows({ assetFlowSnapshots: snapshots, evaluatedAt: CURRENT })
    .find((item) => item.scopeId === "US_EQUITY");
}

function directVariant(base, suffix, overrides = {}) {
  const copy = structuredClone(base);
  copy.snapshotId = `mock.remediation.direct.${suffix}`;
  copy.evidenceRefs[0].evidenceId = `mock.remediation.direct.${suffix}.evidence`;
  copy.sourceMeta.sourceId = `mock.remediation.direct.${suffix}.source`;
  copy.evidenceRefs[0].sourceMeta.sourceId = copy.sourceMeta.sourceId;
  if (overrides.currency !== undefined) copy.currency = overrides.currency;
  if (overrides.flowPeriod !== undefined) copy.flowPeriod = overrides.flowPeriod;
  if (overrides.latencyClass !== undefined) {
    copy.sourceMeta.latencyClass = overrides.latencyClass;
    copy.evidenceRefs[0].sourceMeta.latencyClass = overrides.latencyClass;
  }
  for (const field of ["reportingPeriodStart", "reportingPeriodEnd"]) {
    if (overrides[field] !== undefined) {
      copy.sourceMeta[field] = overrides[field];
      copy.evidenceRefs[0].sourceMeta[field] = overrides[field];
    }
  }
  if (overrides.unit !== undefined) {
    copy.flowValue.unit = overrides.unit;
    copy.evidenceRefs[0].unit = overrides.unit;
  }
  if (overrides.value !== undefined) {
    copy.flowValue.value = overrides.value;
    copy.evidenceRefs[0].value = overrides.value;
  }
  return copy;
}

function assertDirectAggregationFailedClosed(assessment, dimension) {
  assert.equal(assessment.state, FlowState.INSUFFICIENT);
  assert.equal(assessment.trafficLight, TrafficLight.GREY);
  assert.equal(assessment.score, null);
  assert.equal(assessment.directFlowValue, null);
  assert.equal(assessment.currency, null);
  assert.equal(assessment.reportingPeriod, null);
  assert.ok(assessment.confidence.degradedBy.some((item) => item.includes(dimension)));
}

test("F001 selects an exact at-target historical candidate", () => {
  const exact = atTimestamp(RISK_ON.marketSnapshots[3], "market.exact-target", TARGET);
  const result = marketHistoryResult([exact]);
  assert.equal(result.status, HistoricalWindowResult.FOUND);
  assert.equal(result.snapshot.snapshotId, exact.snapshotId);
  assert.equal(result.differenceSeconds, 0);
});

test("F001 rejects a closer post-target candidate before nearest selection", () => {
  const older = atTimestamp(RISK_ON.marketSnapshots[2], "market.older-eligible", "2026-02-03T19:24:00.000Z");
  const postTarget = atTimestamp(RISK_ON.marketSnapshots[3], "market.post-target-ineligible", "2026-02-03T19:35:00.000Z");
  const result = marketHistoryResult([older, postTarget]);
  assert.equal(result.status, HistoricalWindowResult.FOUND);
  assert.equal(result.snapshot.snapshotId, older.snapshotId);
  assert.ok(Date.parse(result.snapshot.timestamp) <= Date.parse(result.targetTimestamp));
});

test("F001 post-target-only history fails closed", () => {
  const postTarget = atTimestamp(RISK_ON.marketSnapshots[3], "market.post-target-only", "2026-02-03T19:35:00.000Z");
  const result = marketHistoryResult([postTarget]);
  assert.equal(result.status, HistoricalWindowResult.INSUFFICIENT);
  assert.equal(result.snapshot, null);
});

test("F001 applies backward tolerance only", () => {
  const older = atTimestamp(RISK_ON.marketSnapshots[2], "market.outside-backward-tolerance", "2026-02-03T19:24:00.000Z");
  const result = marketHistoryResult([older], { minutes: 30, toleranceSeconds: 300 });
  assert.equal(result.status, HistoricalWindowResult.MISSING);
  assert.equal(result.snapshot, null);
  assert.equal(result.differenceSeconds, 360);
});

for (const [contractName, scopeId, current] of [
  ["MarketSnapshot", "US_MARKET", RISK_ON.marketSnapshots.at(-1)],
  ["BreadthSnapshot", "US_COMPOSITE", RISK_ON.breadthSnapshots.at(-1)],
  ["SectorSnapshot", "TECHNOLOGY", RISK_ON.sectorSnapshots.filter((item) => item.sectorId === "TECHNOLOGY").at(-1)],
]) {
  test(`F002 ${contractName} rejects a cross-session candidate`, () => {
    const candidate = candidateFor(contractName, current, `${contractName}.cross-session`, { sessionDate: "2026-02-02" });
    const result = comparisonForContract(contractName, scopeId, current, candidate);
    assert.equal(result.status, HistoricalWindowResult.INSUFFICIENT);
    assert.equal(result.snapshot, null);
  });
}

test("F002 missing SessionIdentity fails closed for current and candidate snapshots", () => {
  const current = structuredClone(RISK_ON.marketSnapshots.at(-1));
  const candidate = candidateFor("MarketSnapshot", current, "market.missing-candidate-identity");
  delete candidate.sessionIdentity;
  assert.equal(comparisonForContract("MarketSnapshot", "US_MARKET", current, candidate).status, HistoricalWindowResult.INSUFFICIENT);
  delete current.sessionIdentity;
  const validCandidate = candidateFor("MarketSnapshot", RISK_ON.marketSnapshots.at(-1), "market.current-missing-identity");
  assert.equal(comparisonForContract("MarketSnapshot", "US_MARKET", current, validCandidate).status, HistoricalWindowResult.INSUFFICIENT);
});

test("F002 rejects sessionPhase mismatch", () => {
  const current = RISK_ON.marketSnapshots.at(-1);
  const candidate = candidateFor("MarketSnapshot", current, "market.phase-mismatch", { sessionPhase: "premarket" });
  assert.equal(comparisonForContract("MarketSnapshot", "US_MARKET", current, candidate).status, HistoricalWindowResult.INSUFFICIENT);
});

test("F002 rejects sessionCalendarId mismatch", () => {
  const current = RISK_ON.breadthSnapshots.at(-1);
  const candidate = candidateFor("BreadthSnapshot", current, "breadth.calendar-mismatch", { sessionCalendarId: "mock.other-calendar.v1" });
  assert.equal(comparisonForContract("BreadthSnapshot", "US_COMPOSITE", current, candidate).status, HistoricalWindowResult.INSUFFICIENT);
});

test("F002 validates complete SessionIdentity and rejects MarketSnapshot contradiction", () => {
  const valid = structuredClone(RISK_ON.marketSnapshots.at(-1));
  validateContract("MarketSnapshot", valid);
  const incomplete = structuredClone(valid);
  delete incomplete.sessionIdentity.sessionCalendarId;
  assert.throws(() => validateContract("MarketSnapshot", incomplete), /sessionCalendarId/);
  const contradictory = structuredClone(valid);
  contradictory.sessionIdentity.sessionDate = "2026-02-02";
  assert.throws(() => validateContract("MarketSnapshot", contradictory), /must match sessionIdentity/);
});

test("F002 invalid same-session history makes every direction UNKNOWN/GREY/score=null", () => {
  const currentMarket = RISK_ON.marketSnapshots.at(-1);
  const currentBreadth = RISK_ON.breadthSnapshots.at(-1);
  const currentSectors = RISK_ON.sectorSnapshots.filter((item) => item.timestamp === CURRENT);
  const window = new HistoricalSnapshotWindow({ outOfOrderPolicy: "SORT" });
  const priorMarket = candidateFor("MarketSnapshot", currentMarket, "direction.market.cross-session", { sessionDate: "2026-02-02" });
  const priorBreadth = candidateFor("BreadthSnapshot", currentBreadth, "direction.breadth.cross-session", { sessionDate: "2026-02-02" });
  window.append("MarketSnapshot", "US_MARKET", priorMarket).append("MarketSnapshot", "US_MARKET", currentMarket);
  window.append("BreadthSnapshot", currentBreadth.venue, priorBreadth).append("BreadthSnapshot", currentBreadth.venue, currentBreadth);
  currentSectors.forEach((current) => {
    const prior = candidateFor("SectorSnapshot", current, `direction.${current.sectorId}.cross-session`, { sessionDate: "2026-02-02" });
    window.append("SectorSnapshot", current.sectorId, prior).append("SectorSnapshot", current.sectorId, current);
  });
  const outputs = evaluateMarketDirection({ marketSnapshot: currentMarket, breadthSnapshot: currentBreadth, sectorSnapshots: currentSectors, historicalWindow: window, evaluatedAt: CURRENT, sessionStartTimestamp: RISK_ON.sessionStartTimestamp });
  assert.equal(outputs.every((item) => item.direction === DirectionState.UNKNOWN && item.trafficLight === TrafficLight.GREY && item.score === null), true);
});

test("F003 MarketRegime preserves DIRECT positive versus PROXY negative opposition", () => {
  const scenario = MARKET_CONTEXT_SCENARIOS.DIRECT_PROXY_CONFLICT;
  const currentMarket = scenario.marketSnapshots.at(-1);
  const currentBreadth = scenario.breadthSnapshots.at(-1);
  const currentSectors = scenario.sectorSnapshots.filter((item) => item.timestamp === CURRENT);
  const assessments = evaluateUSAssetFlows({ assetFlowSnapshots: scenario.assetFlowSnapshots, evaluatedAt: CURRENT });
  const regime = evaluateMarketRegime({ marketSnapshot: currentMarket, breadthSnapshot: currentBreadth, sectorSnapshots: currentSectors, assetFlowSnapshots: scenario.assetFlowSnapshots, assetFlowAssessments: assessments, evaluatedAt: CURRENT });
  const equity = assessments.find((item) => item.scopeId === "US_EQUITY");
  assert.equal(regime.state, "CONFLICTED");
  assert.ok(equity.directEvidence.some((evidence) => regime.supportingEvidence.some((item) => item.evidenceId === evidence.evidenceId)));
  assert.ok(equity.proxyEvidence.some((evidence) => regime.opposingEvidence.some((item) => item.evidenceId === evidence.evidenceId)));
});

test("F003 prevents DIRECT double counting by evidence provenance", () => {
  const raw = RISK_ON.assetFlowSnapshots.find((item) => item.assetClass === "US_EQUITY");
  const assessments = evaluateUSAssetFlows({ assetFlowSnapshots: [raw], evaluatedAt: CURRENT });
  const args = {
    marketSnapshot: RISK_ON.marketSnapshots.at(-1),
    breadthSnapshot: RISK_ON.breadthSnapshots.at(-1),
    sectorSnapshots: RISK_ON.sectorSnapshots.filter((item) => item.timestamp === CURRENT),
    assetFlowAssessments: assessments,
    evaluatedAt: CURRENT,
  };
  const assessmentOnly = evaluateMarketRegime(args);
  const withDuplicateRaw = evaluateMarketRegime({ ...args, assetFlowSnapshots: [raw] });
  assert.equal(withDuplicateRaw.score, assessmentOnly.score);
  const evidenceId = raw.evidenceRefs[0].evidenceId;
  assert.equal([...withDuplicateRaw.supportingEvidence, ...withDuplicateRaw.opposingEvidence].filter((item) => item.evidenceId === evidenceId).length, 1);
});

test("F003 DIRECT-only assessment retains measured provenance", () => {
  const direct = RISK_ON.assetFlowSnapshots.find((item) => item.assetClass === "US_EQUITY" && item.flowType === "DIRECT");
  const assessment = equityAssessment([direct]);
  assert.equal(assessment.flowMode, FlowMode.DIRECT);
  assert.ok(assessment.directFlowValue > 0);
  assert.ok(assessment.directEvidence.length > 0);
  assert.deepEqual(assessment.proxyEvidence, []);
});

test("F003 PROXY-only assessment cannot create measured cash flow", () => {
  const proxy = MARKET_CONTEXT_SCENARIOS.DIRECT_PROXY_CONFLICT.assetFlowSnapshots.find((item) => item.assetClass === "US_EQUITY" && item.flowType === "PROXY");
  const assessment = equityAssessment([proxy]);
  assert.equal(assessment.flowMode, FlowMode.PROXY);
  assert.equal(assessment.directFlowValue, null);
  assert.equal(assessment.currency, null);
  assert.deepEqual(assessment.directEvidence, []);
  assert.ok(assessment.proxyEvidence.length > 0);
});

test("F004 rejects incompatible DIRECT currency aggregation", () => {
  const base = RISK_ON.assetFlowSnapshots.find((item) => item.assetClass === "US_EQUITY");
  assertDirectAggregationFailedClosed(equityAssessment([base, directVariant(base, "currency", { currency: "EUR" })]), "currency");
});

test("F004 rejects incompatible reportingPeriodStart aggregation", () => {
  const base = RISK_ON.assetFlowSnapshots.find((item) => item.assetClass === "US_EQUITY");
  assertDirectAggregationFailedClosed(equityAssessment([base, directVariant(base, "period-start", { reportingPeriodStart: "2026-02-01T00:00:00.000Z" })]), "reportingPeriodStart");
});

test("F004 rejects incompatible reportingPeriodEnd aggregation", () => {
  const base = RISK_ON.assetFlowSnapshots.find((item) => item.assetClass === "US_EQUITY");
  assertDirectAggregationFailedClosed(equityAssessment([base, directVariant(base, "period-end", { reportingPeriodEnd: "2026-02-01T23:59:59.000Z" })]), "reportingPeriodEnd");
});

test("F004 rejects incompatible flowPeriod aggregation", () => {
  const base = RISK_ON.assetFlowSnapshots.find((item) => item.assetClass === "US_EQUITY");
  assertDirectAggregationFailedClosed(equityAssessment([base, directVariant(base, "flow-period", { flowPeriod: "weekly" })]), "flowPeriod");
});

test("F004 rejects incompatible latencyClass aggregation", () => {
  const base = RISK_ON.assetFlowSnapshots.find((item) => item.assetClass === "US_EQUITY");
  assertDirectAggregationFailedClosed(equityAssessment([base, directVariant(base, "latency", { latencyClass: "weekly" })]), "latencyClass");
});

test("F004 rejects incompatible normalized measurement units", () => {
  const base = RISK_ON.assetFlowSnapshots.find((item) => item.assetClass === "US_EQUITY");
  assertDirectAggregationFailedClosed(equityAssessment([base, directVariant(base, "unit", { unit: "USD_millions" })]), "flowValue.unit");
});

test("F004 handles fully compatible DIRECT records deterministically", () => {
  const base = RISK_ON.assetFlowSnapshots.find((item) => item.assetClass === "US_EQUITY");
  const second = directVariant(base, "compatible", { value: base.flowValue.value });
  const firstResult = equityAssessment([base, second]);
  const secondResult = equityAssessment([second, base]);
  assert.equal(firstResult.directFlowValue, Number((base.flowValue.value + second.flowValue.value).toFixed(4)));
  assert.equal(firstResult.currency, "USD");
  assert.equal(deterministicSerialize("FlowAssessment", firstResult), deterministicSerialize("FlowAssessment", secondResult));
});

test("F004 missing DIRECT provenance fails closed instead of creating a measured value", () => {
  const base = RISK_ON.assetFlowSnapshots.find((item) => item.assetClass === "US_EQUITY");
  const missingEvidence = directVariant(base, "missing-evidence");
  missingEvidence.evidenceRefs = [];
  assertDirectAggregationFailedClosed(equityAssessment([missingEvidence]), "directEvidence");
});

test("fail-closed regressions preserve stale DIRECT and missing-evidence semantics", () => {
  const base = RISK_ON.assetFlowSnapshots.find((item) => item.assetClass === "US_EQUITY");
  const stale = directVariant(base, "stale");
  stale.sourceMeta.isStale = true;
  stale.evidenceRefs[0].sourceMeta.isStale = true;
  const staleAssessment = equityAssessment([stale]);
  assert.equal(staleAssessment.state, FlowState.INSUFFICIENT);
  assert.equal(staleAssessment.directFlowValue, null);
  const missing = equityAssessment([]);
  assert.equal(missing.state, FlowState.INSUFFICIENT);
  assert.equal(missing.trafficLight, TrafficLight.GREY);
  assert.equal(missing.score, null);
});
