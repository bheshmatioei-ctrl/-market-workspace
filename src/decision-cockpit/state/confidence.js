import { FreshnessStatus, SCHEMA_VERSION, TrafficLight } from "../domain/constants.js";
import { validateConfidence } from "../contracts/validators.js";

// Foundation-only degradation policy. It is deliberately isolated and may not
// be used as a production analytical-engine weighting model.
export const FOUNDATION_CONFIDENCE_POLICY = Object.freeze({
  missingInputPenalty: 0.12,
  degradedInputPenalty: 0.1,
  staleInputPenalty: 0.25,
  conflictPenalty: 0.18,
  lowQualityPenalty: 0.12,
  lowQualityThreshold: 0.6,
});

export function degradeConfidence(baseConfidence, conditions, policy = FOUNDATION_CONFIDENCE_POLICY) {
  validateConfidence(baseConfidence);
  const degradedBy = [...baseConfidence.degradedBy];
  let penalty = 0;

  const missingCount = Math.max(0, conditions.missingCount ?? 0);
  const freshnessStatuses = conditions.freshnessStatuses ?? [];
  const conflictCount = Math.max(0, conditions.conflictCount ?? 0);
  const qualityScores = conditions.qualityScores ?? [];

  if (missingCount > 0) {
    penalty += policy.missingInputPenalty * missingCount;
    degradedBy.push(`${missingCount} required input(s) missing`);
  }
  const degradedCount = freshnessStatuses.filter((status) => status === FreshnessStatus.DEGRADED).length;
  const staleCount = freshnessStatuses.filter((status) => [FreshnessStatus.STALE, FreshnessStatus.UNAVAILABLE].includes(status)).length;
  if (degradedCount > 0) {
    penalty += policy.degradedInputPenalty * degradedCount;
    degradedBy.push(`${degradedCount} input(s) degraded`);
  }
  if (staleCount > 0) {
    penalty += policy.staleInputPenalty * staleCount;
    degradedBy.push(`${staleCount} input(s) stale or unavailable`);
  }
  if (conflictCount > 0) {
    penalty += policy.conflictPenalty * conflictCount;
    degradedBy.push(`${conflictCount} evidence conflict(s)`);
  }
  const lowQualityCount = qualityScores.filter((score) => score < policy.lowQualityThreshold).length;
  if (lowQualityCount > 0) {
    penalty += policy.lowQualityPenalty * lowQualityCount;
    degradedBy.push(`${lowQualityCount} low-quality source(s)`);
  }

  return Object.freeze({
    schemaVersion: SCHEMA_VERSION,
    score: Math.max(0, Number((baseConfidence.score - penalty).toFixed(4))),
    reasons: Object.freeze([...baseConfidence.reasons]),
    degradedBy: Object.freeze([...new Set(degradedBy)]),
  });
}

export function availabilityTrafficLight({ requiredValues, freshnessStatuses }) {
  const missing = requiredValues.some((value) => value === null || value === undefined);
  const nonDecisionGrade = freshnessStatuses.some((status) => [FreshnessStatus.STALE, FreshnessStatus.UNAVAILABLE].includes(status));
  return missing || nonDecisionGrade ? TrafficLight.GREY : null;
}

