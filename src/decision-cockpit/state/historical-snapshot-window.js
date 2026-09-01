import { validateContract } from "../contracts/validators.js";
import { immutableClone } from "../engines/engine-utils.js";

const RESULT = Object.freeze({ FOUND: "FOUND", MISSING: "MISSING", INSUFFICIENT: "INSUFFICIENT" });

function timestampMs(value) {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) throw new TypeError(`Invalid timestamp: ${value}`);
  return parsed;
}

export class HistoricalSnapshotWindow {
  #records = new Map();
  #outOfOrderPolicy;

  constructor({ outOfOrderPolicy = "REJECT" } = {}) {
    if (!['REJECT', 'SORT'].includes(outOfOrderPolicy)) throw new Error("outOfOrderPolicy must be REJECT or SORT");
    this.#outOfOrderPolicy = outOfOrderPolicy;
  }

  append(contractName, scopeId, snapshot) {
    validateContract(contractName, snapshot);
    if (typeof scopeId !== "string" || scopeId.length === 0) throw new TypeError("scopeId is required");
    const key = `${contractName}:${scopeId}`;
    const records = this.#records.get(key) ?? [];
    const incomingMs = timestampMs(snapshot.timestamp);
    if (records.some((item) => item.snapshot.snapshotId === snapshot.snapshotId)) throw new Error(`Duplicate snapshotId: ${snapshot.snapshotId}`);
    if (this.#outOfOrderPolicy === "REJECT" && records.length && incomingMs <= records.at(-1).timestampMs) {
      throw new Error(`Out-of-order snapshot rejected: ${snapshot.snapshotId}`);
    }
    records.push({ timestampMs: incomingMs, snapshot: immutableClone(snapshot) });
    records.sort((left, right) => left.timestampMs - right.timestampMs || left.snapshot.snapshotId.localeCompare(right.snapshot.snapshotId));
    this.#records.set(key, records);
    return this;
  }

  series(contractName, scopeId, { atOrBefore } = {}) {
    const records = this.#records.get(`${contractName}:${scopeId}`) ?? [];
    const maximum = atOrBefore ? timestampMs(atOrBefore) : Infinity;
    return Object.freeze(records.filter((item) => item.timestampMs <= maximum).map((item) => item.snapshot));
  }

  latestAtOrBefore(contractName, scopeId, evaluatedAt) {
    return this.series(contractName, scopeId, { atOrBefore: evaluatedAt }).at(-1) ?? null;
  }

  comparisonFor(contractName, scopeId, currentSnapshot, {
    minutes = null,
    sessionStartTimestamp = null,
    toleranceSeconds = 600,
    sameSession = true,
  } = {}) {
    validateContract(contractName, currentSnapshot);
    const currentMs = timestampMs(currentSnapshot.timestamp);
    const targetMs = sessionStartTimestamp ? timestampMs(sessionStartTimestamp) :
      Number.isFinite(minutes) ? currentMs - (minutes * 60_000) : null;
    if (targetMs === null) return immutableClone({ status: RESULT.MISSING, reason: "A comparison horizon is required.", targetTimestamp: null, snapshot: null, differenceSeconds: null });
    if (targetMs > currentMs) return immutableClone({ status: RESULT.MISSING, reason: "Future comparison targets are forbidden.", targetTimestamp: new Date(targetMs).toISOString(), snapshot: null, differenceSeconds: null });

    const candidates = this.series(contractName, scopeId, { atOrBefore: currentSnapshot.timestamp })
      .filter((item) => item.snapshotId !== currentSnapshot.snapshotId)
      .filter((item) => !sameSession || !currentSnapshot.sessionDate || !item.sessionDate || item.sessionDate === currentSnapshot.sessionDate)
      .filter((item) => !sameSession || !currentSnapshot.sessionPhase || !item.sessionPhase || item.sessionPhase === currentSnapshot.sessionPhase);
    const ordered = candidates
      .map((snapshot) => ({ snapshot, differenceSeconds: Math.abs(timestampMs(snapshot.timestamp) - targetMs) / 1000 }))
      .sort((left, right) => left.differenceSeconds - right.differenceSeconds || timestampMs(right.snapshot.timestamp) - timestampMs(left.snapshot.timestamp));
    const match = ordered[0];
    if (!match) return immutableClone({ status: RESULT.INSUFFICIENT, reason: "No past snapshot is available in the requested session.", targetTimestamp: new Date(targetMs).toISOString(), snapshot: null, differenceSeconds: null });
    if (match.differenceSeconds > toleranceSeconds) return immutableClone({ status: RESULT.MISSING, reason: "No past snapshot falls inside the explicit comparison tolerance; interpolation is forbidden.", targetTimestamp: new Date(targetMs).toISOString(), snapshot: null, differenceSeconds: match.differenceSeconds });
    return immutableClone({ status: RESULT.FOUND, reason: "Exact or tolerance-qualified past snapshot found without interpolation.", targetTimestamp: new Date(targetMs).toISOString(), snapshot: match.snapshot, differenceSeconds: match.differenceSeconds });
  }
}

export const HistoricalWindowResult = RESULT;
