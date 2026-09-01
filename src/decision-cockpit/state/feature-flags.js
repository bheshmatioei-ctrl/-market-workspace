import { FeatureLifecycle } from "../domain/constants.js";
import { validateFeatureLifecycle } from "../contracts/validators.js";

export const DEFAULT_FEATURE_FLAGS = Object.freeze({
  marketRegimeEngine: FeatureLifecycle.SHADOW,
  marketDirectionEngine: FeatureLifecycle.SHADOW,
  moneyFlowEngine: FeatureLifecycle.SHADOW,
  globalCapitalRotation: FeatureLifecycle.SHADOW,
  usAssetFlowMonitor: FeatureLifecycle.SHADOW,
  premarketIntelligence: FeatureLifecycle.SHADOW,
  anomalyRadar: FeatureLifecycle.SHADOW,
  stockDecisionEngine: FeatureLifecycle.OFF,
  tradeDecisionZones: FeatureLifecycle.OFF,
  modelTestLab: FeatureLifecycle.SHADOW,
});

export class FeatureFlagRegistry {
  #flags;

  constructor(initial = DEFAULT_FEATURE_FLAGS) {
    this.#flags = new Map();
    for (const [name, lifecycle] of Object.entries(initial)) this.set(name, lifecycle);
  }

  set(name, lifecycle) {
    if (typeof name !== "string" || name.length === 0) throw new TypeError("Feature name is required");
    validateFeatureLifecycle(lifecycle);
    this.#flags.set(name, lifecycle);
    return this;
  }

  get(name) {
    if (!this.#flags.has(name)) throw new Error(`Unknown feature flag: ${name}`);
    return this.#flags.get(name);
  }

  canCompute(name) {
    return this.get(name) !== FeatureLifecycle.OFF;
  }

  canRender(name) {
    return [FeatureLifecycle.BETA, FeatureLifecycle.ACTIVE].includes(this.get(name));
  }

  canInfluenceComposite(name) {
    return this.get(name) === FeatureLifecycle.ACTIVE;
  }

  snapshot() {
    return Object.freeze(Object.fromEntries([...this.#flags.entries()].sort(([left], [right]) => left.localeCompare(right))));
  }
}
