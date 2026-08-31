import { validateEvidenceRef } from "../contracts/validators.js";

function uniqueEvidence(items) {
  const byId = new Map();
  for (const item of items) {
    validateEvidenceRef(item);
    if (!byId.has(item.evidenceId)) byId.set(item.evidenceId, item);
  }
  return [...byId.values()];
}

export function aggregateEvidence({ supporting = [], opposing = [] }) {
  const normalizedSupporting = uniqueEvidence(supporting);
  const normalizedOpposing = uniqueEvidence(opposing);
  const supportingIds = new Set(normalizedSupporting.map((item) => item.evidenceId));
  const duplicateSides = normalizedOpposing.filter((item) => supportingIds.has(item.evidenceId)).map((item) => item.evidenceId);

  const valuesByField = new Map();
  for (const item of [...normalizedSupporting, ...normalizedOpposing]) {
    if (!valuesByField.has(item.field)) valuesByField.set(item.field, new Set());
    valuesByField.get(item.field).add(`${typeof item.value}:${String(item.value)}:${item.unit ?? ""}`);
  }
  const conflictingFields = [...valuesByField.entries()]
    .filter(([, values]) => values.size > 1)
    .map(([field]) => field)
    .sort();

  return Object.freeze({
    supporting: Object.freeze(normalizedSupporting),
    opposing: Object.freeze(normalizedOpposing),
    conflicts: Object.freeze({
      evidenceOnBothSides: Object.freeze(duplicateSides.sort()),
      fieldsWithDifferentValues: Object.freeze(conflictingFields),
    }),
  });
}

