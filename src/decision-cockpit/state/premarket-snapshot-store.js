import { deterministicSerialize } from "../contracts/serialization.js";
import { validateContract } from "../contracts/validators.js";
import { PremarketFreezeStatus } from "../domain/constants.js";
import { immutableClone } from "../engines/engine-utils.js";

const lexicalCompare = (left, right) => left < right ? -1 : left > right ? 1 : 0;

export class PremarketSnapshotStore {
  #records = new Map();

  append(snapshot) {
    validateContract("PremarketSnapshot", snapshot);
    if (snapshot.freezeStatus !== PremarketFreezeStatus.FROZEN) {
      throw new Error("Only FROZEN PremarketSnapshot records may enter immutable history");
    }
    const serialized = deterministicSerialize("PremarketSnapshot", snapshot);
    const existing = this.#records.get(snapshot.snapshotId);
    if (existing) {
      if (existing.serialized !== serialized) throw new Error(`Frozen PremarketSnapshot mutation is forbidden: ${snapshot.snapshotId}`);
      return existing.snapshot;
    }
    const immutable = immutableClone(snapshot);
    this.#records.set(snapshot.snapshotId, { snapshot: immutable, serialized });
    return immutable;
  }

  get(snapshotId) {
    return this.#records.get(snapshotId)?.snapshot ?? null;
  }

  list() {
    return Object.freeze([...this.#records.values()]
      .map((entry) => entry.snapshot)
      .sort((left, right) => lexicalCompare(left.snapshotId, right.snapshotId)));
  }
}
