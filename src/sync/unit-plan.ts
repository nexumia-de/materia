// The pure step of one sync cycle for any unit (docs/sync.md#the-unit-plan):
// the same rules as planSync, over named collections.

import { compareText } from './canonical';
import { mergePlace } from './places';
import { mergeRecords, type SyncRecord } from './records';
import { UNIT_FORMAT, UNIT_VERSION, type UnitDocument, type UnitInfo, type UnitKind } from './unit';

export interface LocalUnitState<V = unknown> {
  kind: UnitKind;
  unit: UnitInfo;
  collections: Record<string, SyncRecord<V>[]>;
}

export interface UnitSyncPlan<V = unknown> {
  /** What the app stores locally after this cycle. */
  local: LocalUnitState<V>;
  localChanged: boolean;
  /** The document to write, or undefined when the remote already equals the merge. */
  write?: UnitDocument<V>;
  /** The remote document says the unit moved; nothing is written. */
  moved?: { at: string; note?: string };
  /** Dropped records as `<collection>:<local|remote>:<key>`. */
  rejected: string[];
}

const has = (o: object, k: string): boolean => Object.prototype.hasOwnProperty.call(o, k);

/**
 * Merges the local state of a unit with the remote document. `remote`
 * undefined: no file yet, so the local state is written. A collection on one
 * side only is kept and, where the other side lacks it, written or stored. A
 * remote marked moved still gives the merged state but nothing to write.
 * @param local The local kind, unit and collections.
 * @param remote The parsed remote document, or undefined when there is none.
 * @returns The plan, or `other-unit` when the ids differ, or `other-kind`
 * when the kinds differ.
 */
export function planUnitSync<V>(
  local: LocalUnitState<V>,
  remote: UnitDocument<V> | undefined,
): UnitSyncPlan<V> | { error: 'other-unit' | 'other-kind' } {
  if (remote && remote.unit.id !== local.unit.id) return { error: 'other-unit' };
  if (remote && remote.kind !== local.kind) return { error: 'other-kind' };
  const remoteCollections = remote?.collections ?? {};
  const names = [
    ...new Set([...Object.keys(local.collections), ...Object.keys(remoteCollections)]),
  ];
  names.sort(compareText);
  const merged = remote ? mergePlace(local.unit, remote.unit) : undefined;
  const unit = merged?.place ?? local.unit;
  const collections: Record<string, SyncRecord<V>[]> = {};
  const rejected: string[] = [];
  let localChanged = merged?.changedLocal === true;
  let remoteDiffers = !remote || merged?.changedRemote === true;
  for (const name of names) {
    const l = has(local.collections, name)
      ? (local.collections[name] as SyncRecord<V>[])
      : undefined;
    const r = has(remoteCollections, name)
      ? (remoteCollections[name] as SyncRecord<V>[])
      : undefined;
    const m = mergeRecords(l ?? [], r ?? []);
    collections[name] = m.records;
    rejected.push(...m.rejected.map((x) => `${name}:${x}`));
    // A collection the merge drops records from or the other side lacks is a change.
    localChanged ||= !l || m.changedLocal.length > 0 || m.records.length !== l.length;
    remoteDiffers ||= !r || m.changedRemote.length > 0 || m.records.length !== r.length;
  }
  const plan: UnitSyncPlan<V> = {
    local: { kind: local.kind, unit, collections },
    localChanged,
    rejected,
  };
  if (remote?.moved) {
    plan.moved = remote.moved;
    return plan;
  }
  if (remoteDiffers) {
    plan.write = {
      format: UNIT_FORMAT,
      version: UNIT_VERSION,
      kind: local.kind,
      unit,
      collections,
    };
  }
  return plan;
}
