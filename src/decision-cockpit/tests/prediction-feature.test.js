import test from "node:test";
import assert from "node:assert/strict";
import { ImmutablePredictionStore } from "../validation/prediction-store.js";
import { DEFAULT_FEATURE_FLAGS, FeatureFlagRegistry } from "../state/feature-flags.js";
import { FeatureLifecycle, SCHEMA_VERSION } from "../domain/constants.js";
import { predictionRecordFixture } from "../mocks/fixtures.js";

const failedOutcome = {
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

test("PredictionRecord is append-only and immutable after issuance", () => {
  const store = new ImmutablePredictionStore();
  const issued = store.issue(predictionRecordFixture);
  assert.equal(Object.isFrozen(issued), true);
  assert.throws(() => { issued.predictedDirection = "UP"; }, TypeError);
  assert.throws(() => store.issue(predictionRecordFixture), /already exists/);
  assert.equal(typeof store.updatePrediction, "undefined");
  assert.equal(typeof store.deletePrediction, "undefined");
});

test("failed outcomes remain present and cannot be replaced or removed", () => {
  const store = new ImmutablePredictionStore();
  store.issue(predictionRecordFixture);
  const outcome = store.evaluate(failedOutcome);
  assert.equal(outcome.pass, false);
  assert.equal(store.listOutcomes().length, 1);
  assert.throws(() => store.evaluate({ ...failedOutcome, pass: true }), /already exists/);
  assert.equal(typeof store.deleteOutcome, "undefined");
  assert.match(store.exportCanonical(), /\"pass\":false/);
});

test("feature lifecycle handling prevents unfinished modules from influencing composite state", () => {
  const flags = new FeatureFlagRegistry(DEFAULT_FEATURE_FLAGS);
  for (const name of Object.keys(DEFAULT_FEATURE_FLAGS)) assert.equal(flags.canInfluenceComposite(name), false);
  flags.set("globalCapitalRotation", FeatureLifecycle.ACTIVE);
  assert.equal(flags.canCompute("globalCapitalRotation"), true);
  assert.equal(flags.canRender("globalCapitalRotation"), true);
  assert.equal(flags.canInfluenceComposite("globalCapitalRotation"), true);
  assert.throws(() => flags.set("globalCapitalRotation", "TEST"), /Invalid feature lifecycle/);
});

