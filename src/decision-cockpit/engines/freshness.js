import { FreshnessStatus, SCHEMA_VERSION } from "../domain/constants.js";
import { validateSourceMeta } from "../contracts/validators.js";

export const DEFAULT_FRESHNESS_THRESHOLDS = Object.freeze({
  US_EQUITY_PRICE: Object.freeze({ liveMaxSeconds: 15, delayedMaxSeconds: 60, staleAfterSeconds: 300 }),
  FUTURES: Object.freeze({ liveMaxSeconds: 15, delayedMaxSeconds: 60, staleAfterSeconds: 300 }),
  RATES: Object.freeze({ liveMaxSeconds: 300, delayedMaxSeconds: 900, staleAfterSeconds: 1800 }),
  FX_COMMODITY: Object.freeze({ liveMaxSeconds: 60, delayedMaxSeconds: 300, staleAfterSeconds: 900 }),
  MARKET_BREADTH: Object.freeze({ liveMaxSeconds: 300, delayedMaxSeconds: 600, staleAfterSeconds: 900 }),
  PREMARKET_STOCK: Object.freeze({ liveMaxSeconds: 60, delayedMaxSeconds: 300, staleAfterSeconds: 900 }),
  EVENT_NEAR_REALTIME: Object.freeze({ liveMaxSeconds: 600, delayedMaxSeconds: 900, staleAfterSeconds: 1800 }),
  STRUCTURAL_FLOW: Object.freeze({ liveMaxSeconds: 86400, delayedMaxSeconds: 604800, staleAfterSeconds: 2764800 }),
});

function assertThresholds(thresholds) {
  const { liveMaxSeconds, delayedMaxSeconds, staleAfterSeconds } = thresholds;
  if (![liveMaxSeconds, delayedMaxSeconds, staleAfterSeconds].every((item) => Number.isFinite(item) && item >= 0)) {
    throw new TypeError("Freshness thresholds must be non-negative finite seconds");
  }
  if (!(liveMaxSeconds <= delayedMaxSeconds && delayedMaxSeconds <= staleAfterSeconds)) {
    throw new RangeError("Freshness thresholds must be ordered live <= delayed <= stale");
  }
}

export function classifyFreshness(sourceMeta, thresholds, assessedAt = new Date()) {
  validateSourceMeta(sourceMeta);
  assertThresholds(thresholds);

  const assessedAtIso = assessedAt instanceof Date ? assessedAt.toISOString() : new Date(assessedAt).toISOString();
  if (sourceMeta.observedAt === null) {
    return Object.freeze({
      schemaVersion: SCHEMA_VERSION,
      status: FreshnessStatus.UNAVAILABLE,
      assessedAt: assessedAtIso,
      ageSeconds: null,
      reason: "Observation timestamp is unavailable.",
      decisionGrade: false,
    });
  }

  const ageSeconds = Math.max(0, (Date.parse(assessedAtIso) - Date.parse(sourceMeta.observedAt)) / 1000);
  let status;
  let reason;

  if (sourceMeta.isStale || ageSeconds >= thresholds.staleAfterSeconds) {
    status = FreshnessStatus.STALE;
    reason = sourceMeta.isStale ? "Source metadata explicitly marks the observation stale." : `Observation age ${ageSeconds}s reached the stale threshold.`;
  } else if (sourceMeta.latencyClass === "delayed" && ageSeconds <= thresholds.delayedMaxSeconds) {
    status = FreshnessStatus.DELAYED;
    reason = "Known delayed source remains inside its declared delay window.";
  } else if (sourceMeta.latencyClass === "realtime" && ageSeconds <= thresholds.liveMaxSeconds) {
    status = FreshnessStatus.LIVE;
    reason = "Realtime observation is within the live threshold.";
  } else if (ageSeconds <= thresholds.delayedMaxSeconds) {
    status = FreshnessStatus.DELAYED;
    reason = "Observation is usable but outside the live window.";
  } else {
    status = FreshnessStatus.DEGRADED;
    reason = "Observation is older than the target window and confidence must be reduced.";
  }

  return Object.freeze({
    schemaVersion: SCHEMA_VERSION,
    status,
    assessedAt: assessedAtIso,
    ageSeconds,
    reason,
    decisionGrade: ![FreshnessStatus.STALE, FreshnessStatus.UNAVAILABLE].includes(status),
  });
}

export function classifyFreshnessByDomain(sourceMeta, domain, assessedAt = new Date(), matrix = DEFAULT_FRESHNESS_THRESHOLDS) {
  const thresholds = matrix[domain];
  if (!thresholds) throw new Error(`No freshness thresholds configured for domain: ${domain}`);
  return classifyFreshness(sourceMeta, thresholds, assessedAt);
}

