// The pure step of one sync cycle: local state and the remote document in,
// what to store and what to write out (docs/sync.md#the-plan). Reading and
// writing the file, encryption and retries belong to the app.

import type { PlaceDocument } from './document';
import { DOCUMENT_FORMAT, DOCUMENT_VERSION } from './document';
import { mergePlace, type Place } from './places';
import { mergeRecords, type MergeResult, type SyncRecord } from './records';

export interface LocalPlaceState<V, E> {
  place: Place;
  records: SyncRecord<V>[];
  entities: SyncRecord<E>[];
}

export interface SyncPlan<V, E> {
  /** What the app stores locally after this cycle. */
  local: LocalPlaceState<V, E>;
  localChanged: boolean;
  /** The document to write, or undefined when the remote already equals the merge. */
  write?: PlaceDocument<V, E>;
  /** The remote document says the place moved; nothing is written. */
  moved?: { at: string; note?: string };
  /** Dropped records as `<local|remote>:<key>`; those of entities start with `entity:`. */
  rejected: string[];
}

/** The merge dropped or collapsed something of this input, so the stored list is not the input. */
const reshaped = (m: MergeResult<unknown>, input: readonly unknown[]): boolean =>
  m.records.length !== input.length;

/**
 * Merges the local state with the remote document. `remote` undefined: no
 * file yet, so the local state is written. A document of another place is an
 * error result. When the remote is marked moved, the merged state is still
 * returned (nothing local is lost) but nothing is written.
 */
export function planSync<V, E>(
  local: LocalPlaceState<V, E>,
  remote: PlaceDocument<V, E> | undefined,
): SyncPlan<V, E> | { error: 'other-place' } {
  if (remote && remote.place.id !== local.place.id) return { error: 'other-place' };
  const records = mergeRecords(local.records, remote?.records ?? []);
  const entities = mergeRecords(local.entities, remote?.entities ?? []);
  const merged = remote ? mergePlace(local.place, remote.place) : undefined;
  const place = merged?.place ?? local.place;
  const state: LocalPlaceState<V, E> = {
    place,
    records: records.records,
    entities: entities.records,
  };
  const plan: SyncPlan<V, E> = {
    local: state,
    localChanged:
      records.changedLocal.length > 0 ||
      entities.changedLocal.length > 0 ||
      merged?.changedLocal === true ||
      reshaped(records, local.records) ||
      reshaped(entities, local.entities),
    rejected: [...records.rejected, ...entities.rejected.map((r) => `entity:${r}`)],
  };
  if (remote?.moved) {
    plan.moved = remote.moved;
    return plan;
  }
  const remoteDiffers =
    !remote ||
    records.changedRemote.length > 0 ||
    entities.changedRemote.length > 0 ||
    merged?.changedRemote === true ||
    reshaped(records, remote.records) ||
    reshaped(entities, remote.entities);
  if (remoteDiffers) {
    plan.write = {
      format: DOCUMENT_FORMAT,
      version: DOCUMENT_VERSION,
      place,
      records: records.records,
      entities: entities.records,
    };
  }
  return plan;
}
