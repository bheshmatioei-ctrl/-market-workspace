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

