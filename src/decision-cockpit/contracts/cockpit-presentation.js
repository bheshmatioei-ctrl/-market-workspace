import { AssessmentHorizon, PremarketWindow } from "../domain/constants.js";

export const COCKPIT_PROJECTION_MODULE_ID = "cockpit-projection";
export const COCKPIT_PROJECTION_VERSION = "0.5.0";

export const DIRECTION_ORDER = Object.freeze([
  AssessmentHorizon.M30,
  AssessmentHorizon.M60,
  AssessmentHorizon.M120,
  AssessmentHorizon.SESSION,
]);

export const ALERT_SEVERITY_ORDER = Object.freeze(["info", "watch", "warning", "critical"]);
export const GLOBAL_HORIZON_ORDER = Object.freeze(["overnight", "1d", "5d", "1m", "structural"]);
export const COCKPIT_PREMARKET_WINDOW_ORDER = Object.freeze([
  PremarketWindow.AFTERHOURS,
  PremarketWindow.OVERNIGHT,
  PremarketWindow.PREMARKET,
]);

export const lexicalCompare = (left, right) => left < right ? -1 : left > right ? 1 : 0;

function normalizeCanonical(value) {
  if (Array.isArray(value)) return value.map(normalizeCanonical);
  if (value && typeof value === "object") {
    return Object.keys(value).sort(lexicalCompare).reduce((result, key) => {
      if (value[key] !== undefined) result[key] = normalizeCanonical(value[key]);
      return result;
    }, {});
  }
  if (typeof value === "number" && !Number.isFinite(value)) throw new TypeError("Non-finite numbers cannot be canonicalized");
  return value;
}

export function canonicalPresentationValue(value) {
  return JSON.stringify(normalizeCanonical(value));
}

export function orderedCompare(order, left, right) {
  return order.indexOf(left) - order.indexOf(right);
}

export function cockpitProjectionId({ projectionVersion, generatedAt, sourceObjectIds }) {
  return ["cockpit-projection", projectionVersion, generatedAt, ...sourceObjectIds].join("|");
}

export function freshnessDisplayRecordId({ sourceObjectId, status, assessedAt }) {
  return ["freshness-display", sourceObjectId, status, assessedAt].join("|");
}

export function conflictDisplayRecordId({ sourceObjectIds, description }) {
  return ["conflict-display", ...sourceObjectIds, description].join("|");
}

export function warningDisplayRecordId({ sourceObjectId, sourceField, message }) {
  return ["warning-display", sourceObjectId, sourceField, message].join("|");
}
