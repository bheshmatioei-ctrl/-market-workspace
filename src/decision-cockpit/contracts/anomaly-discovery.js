import { AnomalyType, enumValues } from "../domain/constants.js";

export const ANOMALY_TYPE_ORDER = Object.freeze(enumValues(AnomalyType));

const anomalyRank = new Map(ANOMALY_TYPE_ORDER.map((type, index) => [type, index]));

function requiredIdentityPart(value, field) {
  if (typeof value !== "string" || value.length === 0) throw new TypeError(`${field} is required for deterministic identity`);
  return value;
}

export function canonicalAnomalyTypes(types) {
  return Object.freeze([...new Set(types)].sort((left, right) => {
    const leftRank = anomalyRank.get(left);
    const rightRank = anomalyRank.get(right);
    if (leftRank === undefined || rightRank === undefined) throw new TypeError("Unknown anomaly type");
    return leftRank - rightRank;
  }));
}

export function discoveryCandidateId({ engineVersion, ruleProfileId, timestamp, symbol }) {
  return [
    "discovery-candidate",
    requiredIdentityPart(engineVersion, "engineVersion"),
    requiredIdentityPart(ruleProfileId, "ruleProfileId"),
    requiredIdentityPart(timestamp, "timestamp"),
    requiredIdentityPart(symbol, "symbol"),
  ].join(":");
}

export function anomalyAlertId({ engineVersion, ruleProfileId, evaluatedAt, symbol, anomalyType }) {
  if (!anomalyRank.has(anomalyType)) throw new TypeError("Unknown anomaly type");
  return [
    "anomaly-alert",
    requiredIdentityPart(engineVersion, "engineVersion"),
    requiredIdentityPart(ruleProfileId, "ruleProfileId"),
    requiredIdentityPart(evaluatedAt, "evaluatedAt"),
    requiredIdentityPart(symbol, "symbol"),
    anomalyType,
  ].join(":");
}

export function compareAnomalyTypes(left, right) {
  return anomalyRank.get(left) - anomalyRank.get(right);
}
