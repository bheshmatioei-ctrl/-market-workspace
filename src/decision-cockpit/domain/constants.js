export const SCHEMA_VERSION = "1.0.0";

export const EvidenceType = Object.freeze({
  DIRECT: "DIRECT",
  PROXY: "PROXY",
  DERIVED: "DERIVED",
});

export const TrafficLight = Object.freeze({
  GREEN: "GREEN",
  ORANGE: "ORANGE",
  RED: "RED",
  GREY: "GREY",
});

export const DirectionState = Object.freeze({
  IMPROVING: "IMPROVING",
  STABLE: "STABLE",
  DETERIORATING: "DETERIORATING",
  UNKNOWN: "UNKNOWN",
});

export const AssessmentHorizon = Object.freeze({
  M30: "30m",
  M60: "60m",
  M120: "120m",
  SESSION: "SESSION",
});

export const FlowMode = Object.freeze({
  DIRECT: "DIRECT",
  PROXY: "PROXY",
  MIXED: "MIXED",
});

export const FlowState = Object.freeze({
  DEMAND: "DEMAND",
  SELLING_PRESSURE: "SELLING_PRESSURE",
  MIXED: "MIXED",
  NEUTRAL: "NEUTRAL",
  INSUFFICIENT: "INSUFFICIENT",
});

export const GlobalRotationState = Object.freeze({
  POSITIVE_ROTATION: "POSITIVE_ROTATION",
  NEGATIVE_ROTATION: "NEGATIVE_ROTATION",
  MIXED: "MIXED",
  NEUTRAL: "NEUTRAL",
  INSUFFICIENT: "INSUFFICIENT",
});

export const FreshnessStatus = Object.freeze({
  LIVE: "LIVE",
  DELAYED: "DELAYED",
  DEGRADED: "DEGRADED",
  STALE: "STALE",
  UNAVAILABLE: "UNAVAILABLE",
});

export const FeatureLifecycle = Object.freeze({
  OFF: "OFF",
  SHADOW: "SHADOW",
  BETA: "BETA",
  ACTIVE: "ACTIVE",
});

export const SessionPhase = Object.freeze({
  PREMARKET: "premarket",
  REGULAR: "regular",
  AFTERHOURS: "afterhours",
  OVERNIGHT: "overnight",
});

export const enumValues = (enumeration) => Object.values(enumeration);
