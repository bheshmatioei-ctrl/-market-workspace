import { FeatureLifecycle } from "../../domain/constants.js";

const profile = (value) => Object.freeze({
  status: "EXPERIMENTAL",
  lifecycle: FeatureLifecycle.SHADOW,
  ...value,
});

export const MARKET_REGIME_RULE_PROFILE = profile({
  ruleProfileId: "market-regime.experimental.v0.2",
  version: "0.2.0",
  description: "Synthetic multi-family market-regime thresholds for SHADOW validation only.",
  engineId: "market-regime-engine",
  engineVersion: "0.2-shadow",
  minimumEvidenceFamilies: 3,
  riskOnThreshold: 0.28,
  riskOffThreshold: -0.28,
  conflictMagnitude: 0.45,
  highVix: 24,
  lowVix: 18,
});

export const MARKET_DIRECTION_RULE_PROFILE = profile({
  ruleProfileId: "market-direction.experimental.v0.2",
  version: "0.2.0",
  description: "Past-only independent-horizon direction comparisons for SHADOW validation only.",
  engineId: "market-direction-engine",
  engineVersion: "0.2-shadow",
  horizons: Object.freeze({ "30m": 30, "60m": 60, "120m": 120, SESSION: null }),
  comparisonToleranceSeconds: 600,
  minimumComparableFamilies: 3,
  improvingThreshold: 0.18,
  deterioratingThreshold: -0.18,
});

export const MONEY_FLOW_RULE_PROFILE = profile({
  ruleProfileId: "money-flow.experimental.v0.2",
  version: "0.2.0",
  description: "Participation, relative-strength and volume proxy classification for SHADOW validation only.",
  engineId: "money-flow-engine",
  engineVersion: "0.2-shadow",
  minimumProxyFamilies: 3,
  demandThreshold: 0.24,
  sellingThreshold: -0.24,
  conflictMagnitude: 0.35,
});

export const US_ASSET_FLOW_RULE_PROFILE = profile({
  ruleProfileId: "us-asset-flow.experimental.v0.2",
  version: "0.2.0",
  description: "Deterministic direct/proxy US asset-flow classification for SHADOW validation only.",
  engineId: "us-asset-flow-monitor",
  engineVersion: "0.2-shadow",
  requiredAssetClasses: Object.freeze(["US_EQUITY", "US_BOND", "MONEY_MARKET", "GOLD"]),
});

export const GLOBAL_ROTATION_RULE_PROFILE = profile({
  ruleProfileId: "global-rotation.experimental.v0.2",
  version: "0.2.0",
  description: "Horizon-aware multi-component global rotation classification for SHADOW validation only.",
  engineId: "global-capital-rotation-engine",
  engineVersion: "0.2-shadow",
  minimumProxyComponents: 3,
  positiveThreshold: 0.2,
  negativeThreshold: -0.2,
  compatibleLatencyByHorizon: Object.freeze({
    overnight: Object.freeze(["realtime", "delayed", "daily"]),
    "1d": Object.freeze(["realtime", "delayed", "daily"]),
    "5d": Object.freeze(["daily", "weekly"]),
    "1m": Object.freeze(["daily", "weekly", "monthly"]),
    structural: Object.freeze(["monthly", "quarterly"]),
  }),
});

export const BUNDLE_RULE_PROFILE = profile({
  ruleProfileId: "market-context-bundle.experimental.v0.2",
  version: "0.2.0",
  description: "Non-conclusive immutable aggregation of Package 002 SHADOW outputs.",
  engineId: "market-context-bundle-assembler",
  engineVersion: "0.2-shadow",
});

export const ANOMALY_RADAR_RULE_PROFILE = profile({
  ruleProfileId: "anomaly-radar.experimental.v0.3",
  version: "0.3.0",
  description: "Synthetic deterministic anomaly thresholds for Package 003 SHADOW validation only; not empirically validated or production-ready.",
  engineId: "anomaly-radar-engine",
  engineVersion: "0.3-shadow",
  minimumRelativeVolume: 2,
  gapThresholdPct: 2,
  abnormalDollarVolumeThreshold: 50_000_000,
  vwapDistanceThreshold: 0.1,
  relativeStrengthThreshold: 0.5,
  breakoutThreshold: 0.5,
  minimumEvidenceFamilies: 2,
  conflictMagnitude: 0.5,
  minimumSectorMovePct: 0.3,
  minimumStockMovePctForSectorContext: 0.5,
  minimumPriceMovePctForDivergence: 1,
  maximumRelativeVolumeForPriceConfirmation: 0.8,
  maximumPriceResponsePctForVolumeConfirmation: 0.25,
  minimumReferenceSnapshots: 1,
  catalystAssociationWindowSeconds: 86_400,
  severityByAnomalyCount: Object.freeze({ watch: 2, warning: 4, critical: 7 }),
});

export const RULE_PROFILES = Object.freeze([
  MARKET_REGIME_RULE_PROFILE,
  MARKET_DIRECTION_RULE_PROFILE,
  MONEY_FLOW_RULE_PROFILE,
  US_ASSET_FLOW_RULE_PROFILE,
  GLOBAL_ROTATION_RULE_PROFILE,
  BUNDLE_RULE_PROFILE,
  ANOMALY_RADAR_RULE_PROFILE,
]);

export function assertExperimentalShadowProfile(ruleProfile) {
  if (ruleProfile?.status !== "EXPERIMENTAL" || ruleProfile?.lifecycle !== FeatureLifecycle.SHADOW) {
    throw new Error("Analytical rule profiles must remain EXPERIMENTAL and SHADOW.");
  }
  return ruleProfile;
}
