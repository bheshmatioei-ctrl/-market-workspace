import test from "node:test";
import assert from "node:assert/strict";
import { classifyFreshness } from "../engines/freshness.js";
import { aggregateEvidence } from "../state/evidence.js";
import { availabilityTrafficLight, degradeConfidence } from "../state/confidence.js";
import { FreshnessStatus, SCHEMA_VERSION, TrafficLight } from "../domain/constants.js";
import { mockConfidence, mockEvidence, mockSource } from "../mocks/fixtures.js";

const assessedAt = new Date("2026-01-15T15:00:00.000Z");
const thresholds = { liveMaxSeconds: 15, delayedMaxSeconds: 60, staleAfterSeconds: 300 };

function sourceAtAge(ageSeconds, overrides = {}) {
  return mockSource({
    observedAt: new Date(assessedAt.getTime() - ageSeconds * 1000).toISOString(),
    receivedAt: new Date(assessedAt.getTime() - ageSeconds * 1000).toISOString(),
    ...overrides,
  });
}

test("freshness boundaries classify deterministically", () => {
  assert.equal(classifyFreshness(sourceAtAge(15), thresholds, assessedAt).status, FreshnessStatus.LIVE);
  assert.equal(classifyFreshness(sourceAtAge(16), thresholds, assessedAt).status, FreshnessStatus.DELAYED);
  assert.equal(classifyFreshness(sourceAtAge(60), thresholds, assessedAt).status, FreshnessStatus.DELAYED);
  assert.equal(classifyFreshness(sourceAtAge(61), thresholds, assessedAt).status, FreshnessStatus.DEGRADED);
  const stale = classifyFreshness(sourceAtAge(300), thresholds, assessedAt);
  assert.equal(stale.status, FreshnessStatus.STALE);
  assert.equal(stale.decisionGrade, false);
});

test("known delayed and unavailable sources remain explicit", () => {
  assert.equal(classifyFreshness(sourceAtAge(30, { latencyClass: "delayed" }), thresholds, assessedAt).status, FreshnessStatus.DELAYED);
  const unavailable = classifyFreshness(mockSource({ observedAt: null, receivedAt: null, freshnessSeconds: null }), thresholds, assessedAt);
  assert.equal(unavailable.status, FreshnessStatus.UNAVAILABLE);
  assert.equal(unavailable.ageSeconds, null);
});

test("stale, missing, conflicting and low-quality inputs degrade confidence", () => {
  const base = mockConfidence(0.9, ["Base fixture"]);
  const result = degradeConfidence(base, {
    missingCount: 1,
    freshnessStatuses: [FreshnessStatus.STALE],
    conflictCount: 1,
    qualityScores: [0.4],
  });
  assert.ok(result.score < base.score);
  assert.match(result.degradedBy.join(" "), /missing/);
  assert.match(result.degradedBy.join(" "), /stale/);
  assert.equal(result.schemaVersion, SCHEMA_VERSION);
});

test("missing or stale required data produces GREY/unknown availability", () => {
  assert.equal(availabilityTrafficLight({ requiredValues: [1, null], freshnessStatuses: [FreshnessStatus.LIVE] }), TrafficLight.GREY);
  assert.equal(availabilityTrafficLight({ requiredValues: [1, 2], freshnessStatuses: [FreshnessStatus.STALE] }), TrafficLight.GREY);
  assert.equal(availabilityTrafficLight({ requiredValues: [1, 2], freshnessStatuses: [FreshnessStatus.LIVE] }), null);
});

test("evidence aggregation preserves provenance and opposing evidence", () => {
  const supporting = mockEvidence({ id: "support", field: "breadth", value: 1.2, unit: "ratio" });
  const opposing = mockEvidence({ id: "oppose", field: "breadth", value: 0.8, unit: "ratio" });
  const aggregate = aggregateEvidence({ supporting: [supporting, supporting], opposing: [opposing] });
  assert.equal(aggregate.supporting.length, 1);
  assert.equal(aggregate.opposing.length, 1);
  assert.deepEqual(aggregate.conflicts.fieldsWithDifferentValues, ["breadth"]);
  assert.equal(aggregate.supporting[0].sourceMeta.sourceName.includes("MOCK"), true);
});

