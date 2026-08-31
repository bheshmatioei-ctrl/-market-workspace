import { validateContract } from "./validators.js";

function normalize(value) {
  if (Array.isArray(value)) return value.map(normalize);
  if (value && typeof value === "object") {
    return Object.keys(value)
      .sort()
      .reduce((result, key) => {
        if (value[key] !== undefined) result[key] = normalize(value[key]);
        return result;
      }, {});
  }
  if (typeof value === "number" && !Number.isFinite(value)) throw new TypeError("Non-finite numbers cannot be serialized");
  return value;
}

export function deterministicSerialize(contractName, value) {
  validateContract(contractName, value);
  return JSON.stringify(normalize(value));
}

export function deserializeContract(contractName, serialized) {
  const parsed = JSON.parse(serialized);
  validateContract(contractName, parsed);
  return parsed;
}

export function canonicalize(value) {
  return JSON.stringify(normalize(value));
}

