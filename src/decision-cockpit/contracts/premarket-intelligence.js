import { PremarketWindow, enumValues } from "../domain/constants.js";

export const PREMARKET_WINDOW_ORDER = Object.freeze(enumValues(PremarketWindow));

const rank = new Map(PREMARKET_WINDOW_ORDER.map((window, index) => [window, index]));

function required(value, field) {
  if (typeof value !== "string" || value.length === 0) throw new TypeError(`${field} is required for deterministic identity`);
  return value;
}

export function comparePremarketWindows(left, right) {
  const leftRank = rank.get(left);
  const rightRank = rank.get(right);
  if (leftRank === undefined || rightRank === undefined) throw new TypeError("Unknown premarket window");
  return leftRank - rightRank;
}

export function premarketAssessmentId({
  engineVersion,
  ruleProfileId,
  evaluatedAt,
  sessionDate,
  sessionCalendarId,
  window,
}) {
  if (!rank.has(window)) throw new TypeError("Unknown premarket window");
  return [
    "premarket-assessment",
    required(engineVersion, "engineVersion"),
    required(ruleProfileId, "ruleProfileId"),
    required(evaluatedAt, "evaluatedAt"),
    required(sessionDate, "sessionDate"),
    required(sessionCalendarId, "sessionCalendarId"),
    window,
  ].join("|");
}

export function premarketSnapshotId({
  engineVersion,
  ruleProfileId,
  evaluatedAt,
  sessionDate,
  sessionCalendarId,
}) {
  return [
    "premarket-snapshot",
    required(engineVersion, "engineVersion"),
    required(ruleProfileId, "ruleProfileId"),
    required(evaluatedAt, "evaluatedAt"),
    required(sessionDate, "sessionDate"),
    required(sessionCalendarId, "sessionCalendarId"),
  ].join("|");
}

export function parsePremarketAssessmentId(value) {
  if (typeof value !== "string") return null;
  const [prefix, engineVersion, ruleProfileId, evaluatedAt, sessionDate, sessionCalendarId, window, ...extra] = value.split("|");
  if (prefix !== "premarket-assessment" || extra.length || !rank.has(window)) return null;
  return { engineVersion, ruleProfileId, evaluatedAt, sessionDate, sessionCalendarId, window };
}
