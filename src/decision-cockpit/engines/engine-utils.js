import {
  EvidenceType,
  FeatureLifecycle,
  FreshnessStatus,
  SCHEMA_VERSION,
  TrafficLight,
} from "../domain/constants.js";
import { validateEngineMeta } from "../contracts/validators.js";
import { assertExperimentalShadowProfile } from "./rules/profiles.js";

export const clamp = (value, minimum = -1, maximum = 1) => Math.min(maximum, Math.max(minimum, value));
export const round = (value, digits = 4) => Number(value.toFixed(digits));
export const measurementValue = (measurement) => measurement?.value ?? null;

export function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value).forEach(deepFreeze);
  }
  return value;
}

export function immutableClone(value) {
  return deepFreeze(structuredClone(value));
}

export function assertEvaluationTime(evaluatedAt, snapshots = []) {
  const evaluationMs = Date.parse(evaluatedAt);
  if (!Number.isFinite(evaluationMs)) throw new TypeError("evaluatedAt must be a UTC timestamp");
  for (const snapshot of snapshots.filter(Boolean)) {
    const inputId = snapshot.snapshotId ?? snapshot.eventId ?? "unknown-input";
    if (Date.parse(snapshot.timestamp) > evaluationMs) {
      throw new Error(`Future data is forbidden: ${inputId}`);
    }
    const sources = [...(snapshot.evidenceRefs ?? []).map((item) => item.sourceMeta), ...(snapshot.sourceMeta ? [snapshot.sourceMeta] : [])];
    for (const source of sources) {
      if (source.observedAt !== null && Date.parse(source.observedAt) > evaluationMs) throw new Error(`Future source observation is forbidden: ${source.sourceId}`);
      if (source.receivedAt !== null && Date.parse(source.receivedAt) > evaluationMs) throw new Error(`Future source receipt is forbidden: ${source.sourceId}`);
      if (source.reportingPeriodEnd != null && Date.parse(source.reportingPeriodEnd) > evaluationMs) throw new Error(`Future reporting period is forbidden: ${source.sourceId}`);
    }
  }
}

export function createEngineMeta(ruleProfile, evaluatedAt, inputSchemaVersions) {
  assertExperimentalShadowProfile(ruleProfile);
  const meta = deepFreeze({
    engineId: ruleProfile.engineId,
    engineVersion: ruleProfile.engineVersion,
    lifecycle: FeatureLifecycle.SHADOW,
    evaluatedAt,
    inputSchemaVersions: Object.freeze({ ...inputSchemaVersions }),
    ruleProfileId: ruleProfile.ruleProfileId,
    deterministic: true,
  });
  validateEngineMeta(meta);
  return meta;
}

export function freshnessFromInputs(inputs, evaluatedAt, reasonPrefix = "Input freshness") {
  const freshness = inputs.flatMap((item) => {
    if (item?.freshness) return [item.freshness];
    const sources = (item?.evidenceRefs ?? []).map((evidence) => evidence.sourceMeta);
    if (item?.sourceMeta) sources.push(item.sourceMeta);
    return sources.map((source) => ({
      status: source.observedAt === null ? FreshnessStatus.UNAVAILABLE : source.isStale ? FreshnessStatus.STALE :
        source.latencyClass === "realtime" ? FreshnessStatus.LIVE : FreshnessStatus.DELAYED,
      ageSeconds: source.observedAt === null ? null : Math.max(0, (Date.parse(evaluatedAt) - Date.parse(source.observedAt)) / 1000),
    }));
  });
  const statuses = freshness.map((item) => item.status);
  let status = FreshnessStatus.LIVE;
  if (statuses.includes(FreshnessStatus.UNAVAILABLE)) status = FreshnessStatus.UNAVAILABLE;
  else if (statuses.includes(FreshnessStatus.STALE)) status = FreshnessStatus.STALE;
  else if (statuses.includes(FreshnessStatus.DEGRADED)) status = FreshnessStatus.DEGRADED;
  else if (statuses.includes(FreshnessStatus.DELAYED)) status = FreshnessStatus.DELAYED;
  if (freshness.length === 0) status = FreshnessStatus.UNAVAILABLE;
  const ages = freshness.map((item) => item.ageSeconds).filter(Number.isFinite);
  return deepFreeze({
    schemaVersion: SCHEMA_VERSION,
    status,
    assessedAt: evaluatedAt,
    ageSeconds: ages.length ? Math.max(...ages) : null,
    reason: `${reasonPrefix}: ${status}.`,
    decisionGrade: ![FreshnessStatus.STALE, FreshnessStatus.UNAVAILABLE].includes(status),
  });
}

export function confidence({ coverage, conflicts = 0, freshness, reasons = [], degradedBy = [] }) {
  const freshnessPenalty = freshness.status === FreshnessStatus.DEGRADED ? 0.15 :
    [FreshnessStatus.STALE, FreshnessStatus.UNAVAILABLE].includes(freshness.status) ? 0.45 : 0;
  return deepFreeze({
    schemaVersion: SCHEMA_VERSION,
    score: round(clamp(0.25 + (0.65 * coverage) - (0.14 * conflicts) - freshnessPenalty, 0, 1)),
    reasons: Object.freeze([...reasons]),
    degradedBy: Object.freeze([...new Set([
      ...degradedBy,
      ...(conflicts ? [`${conflicts} explicit evidence conflict(s)`] : []),
      ...(!freshness.decisionGrade ? ["Input freshness is not decision-grade"] : []),
    ])]),
  });
}

export function evidenceByType(snapshots) {
  const all = snapshots.flatMap((snapshot) => snapshot?.evidenceRefs ?? []);
  const unique = [...new Map(all.map((item) => [item.evidenceId, item])).values()];
  return {
    direct: unique.filter((item) => item.evidenceType === EvidenceType.DIRECT),
    proxy: unique.filter((item) => [EvidenceType.PROXY, EvidenceType.DERIVED].includes(item.evidenceType)),
  };
}

export function asDerivedProxyEvidence(evidence, prefix) {
  return deepFreeze({
    ...structuredClone(evidence),
    evidenceId: `${prefix}:${evidence.evidenceId}`,
    field: `proxy.${evidence.field}`,
    evidenceType: EvidenceType.DERIVED,
  });
}

export function stateTrafficLight(state) {
  if (["UNKNOWN", "INSUFFICIENT"].includes(state)) return TrafficLight.GREY;
  if (["RISK_ON", "IMPROVING", "DEMAND", "POSITIVE_ROTATION"].includes(state)) return TrafficLight.GREEN;
  if (["RISK_OFF", "DETERIORATING", "SELLING_PRESSURE", "NEGATIVE_ROTATION"].includes(state)) return TrafficLight.RED;
  return TrafficLight.ORANGE;
}

export function signedTrafficLight(value) {
  if (value === null || value === undefined) return TrafficLight.GREY;
  if (value > 0) return TrafficLight.GREEN;
  if (value < 0) return TrafficLight.RED;
  return TrafficLight.ORANGE;
}
