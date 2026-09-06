import { AssessmentHorizon, StockAnalysisOrigin, enumValues } from "../domain/constants.js";

export const STOCK_DECISION_ENGINE_ID = "stock-decision-engine";
export const STOCK_DECISION_ENGINE_VERSION = "0.6-shadow";
export const STOCK_DECISION_RULE_PROFILE_ID = "stock-decision.experimental.v0.6";
export const STOCK_DECISION_RULE_PROFILE_VERSION = "0.6.0";
export const STOCK_ANALYSIS_ORIGIN_ORDER = Object.freeze(enumValues(StockAnalysisOrigin));
export const STOCK_DIRECTION_HORIZON_ORDER = Object.freeze([
  AssessmentHorizon.M30,
  AssessmentHorizon.M60,
  AssessmentHorizon.M120,
  AssessmentHorizon.SESSION,
]);

export const lexicalCompare = (left, right) => left < right ? -1 : left > right ? 1 : 0;

function identityPart(value, field) {
  if (typeof value !== "string" || value.length === 0) throw new TypeError(`${field} is required for deterministic identity`);
  return value;
}

export function stockDecisionId({ engineVersion, ruleProfileId, evaluatedAt, subjectId, symbol }) {
  return [
    "stock-decision",
    identityPart(engineVersion, "engineVersion"),
    identityPart(ruleProfileId, "ruleProfileId"),
    identityPart(evaluatedAt, "evaluatedAt"),
    identityPart(subjectId, "subjectId"),
    identityPart(symbol, "symbol"),
  ].join(":");
}

export function compareDirectionAssessments(left, right) {
  return STOCK_DIRECTION_HORIZON_ORDER.indexOf(left.horizon) - STOCK_DIRECTION_HORIZON_ORDER.indexOf(right.horizon) ||
    lexicalCompare(left.assessmentId, right.assessmentId);
}
