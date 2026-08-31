import { canonicalize } from "../contracts/serialization.js";
import { validateContract } from "../contracts/validators.js";

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value).forEach(deepFreeze);
  }
  return value;
}

export class ImmutablePredictionStore {
  #predictions = new Map();
  #outcomes = new Map();

  issue(record) {
    validateContract("PredictionRecord", record);
    if (this.#predictions.has(record.predictionId)) throw new Error(`Prediction already exists: ${record.predictionId}`);
    const immutable = deepFreeze(clone(record));
    this.#predictions.set(record.predictionId, immutable);
    return immutable;
  }

  evaluate(outcome) {
    validateContract("PredictionOutcome", outcome);
    if (!this.#predictions.has(outcome.predictionId)) throw new Error(`Unknown prediction: ${outcome.predictionId}`);
    if (this.#outcomes.has(outcome.predictionId)) throw new Error(`Outcome already exists: ${outcome.predictionId}`);
    const immutable = deepFreeze(clone(outcome));
    this.#outcomes.set(outcome.predictionId, immutable);
    return immutable;
  }

  getPrediction(predictionId) {
    return this.#predictions.get(predictionId) ?? null;
  }

  getOutcome(predictionId) {
    return this.#outcomes.get(predictionId) ?? null;
  }

  listPredictions() {
    return Object.freeze([...this.#predictions.values()]);
  }

  listOutcomes() {
    return Object.freeze([...this.#outcomes.values()]);
  }

  exportCanonical() {
    return canonicalize({
      predictions: [...this.#predictions.values()],
      outcomes: [...this.#outcomes.values()],
    });
  }
}

