// The merge of two sets of synced records (docs/sync.md#record-merge): per
// key the newer record wins, a tombstone is a record, ties are broken by a
// rule that does not depend on which side is local.

import { canonicalJson, compareText } from './canonical';
import { instantMs } from './instant';

/** One synced record. `deleted: true` is a tombstone and has no value. */
export interface SyncRecord<V = unknown> {
  key: string;
  updatedAt: string;
  deleted?: true;
  value?: V;
}

export interface MergeResult<V> {
  /** The merged set, sorted by key. */
  records: SyncRecord<V>[];
  /** Keys whose merged record differs from the local one (the app must store them). */
  changedLocal: string[];
  /** Keys whose merged record differs from the remote one (the file must be written). */
  changedRemote: string[];
  /** Input records dropped as invalid, as `local:<key>` / `remote:<key>` (the index when there is no key). */
  rejected: string[];
}

/**
 * Checks one record and copies it to its clean form.
 * @param input Any value that should be a record.
 * @returns The clean record, or undefined when the key, the time or the value/tombstone shape is invalid.
 */
export function normaliseRecord<V>(input: unknown): SyncRecord<V> | undefined {
  if (input === null || typeof input !== 'object') return undefined;
  const r = input as Record<string, unknown>;
  if (typeof r.key !== 'string' || r.key === '') return undefined;
  if (instantMs(r.updatedAt) === undefined) return undefined;
  const updatedAt = r.updatedAt as string;
  if (r.deleted === true) {
    if (r.value !== undefined) return undefined;
    return { key: r.key, updatedAt, deleted: true };
  }
  if (r.deleted !== undefined || r.value === undefined) return undefined;
  return { key: r.key, updatedAt, value: r.value as V };
}

/**
 * Picks the winner between two valid records of one key; the same on both sides.
 * @param a One record.
 * @param b The other record of the same key.
 * @returns The newer record; on equal time a tombstone, then the greater value, then the greater timestamp text.
 */
export function winner<V>(a: SyncRecord<V>, b: SyncRecord<V>): SyncRecord<V> {
  const ta = instantMs(a.updatedAt) as number;
  const tb = instantMs(b.updatedAt) as number;
  if (ta !== tb) return ta > tb ? a : b;
  if (a.deleted !== b.deleted) return a.deleted ? a : b;
  const byValue = compareText(canonicalJson(a.value), canonicalJson(b.value));
  if (byValue !== 0) return byValue > 0 ? a : b;
  return compareText(a.updatedAt, b.updatedAt) >= 0 ? a : b;
}

/** Valid records of one side by key (later one wins within the side), plus what was rejected. */
function side<V>(
  records: readonly SyncRecord<V>[],
  label: string,
  rejected: string[],
): Map<string, SyncRecord<V>> {
  const map = new Map<string, SyncRecord<V>>();
  records.forEach((raw, index) => {
    const r = normaliseRecord<V>(raw);
    if (!r) {
      const key = (raw as { key?: unknown } | null)?.key;
      rejected.push(`${label}:${typeof key === 'string' && key !== '' ? key : index}`);
      return;
    }
    const old = map.get(r.key);
    map.set(r.key, old ? winner(old, r) : r);
  });
  return map;
}

const same = (a: SyncRecord | undefined, b: SyncRecord): boolean =>
  a !== undefined && canonicalJson(a) === canonicalJson(b);

/**
 * Merges the local and the remote records. The result is the same when the
 * arguments are swapped, and merging it with either input changes nothing.
 * Tombstones are never removed.
 * @param local The local records.
 * @param remote The remote records.
 * @returns The merged records sorted by key, the keys each side must update, and the rejected input.
 */
export function mergeRecords<V>(
  local: readonly SyncRecord<V>[],
  remote: readonly SyncRecord<V>[],
): MergeResult<V> {
  const rejected: string[] = [];
  const l = side(local, 'local', rejected);
  const r = side(remote, 'remote', rejected);
  const merged = new Map<string, SyncRecord<V>>();
  for (const [key, rec] of l) merged.set(key, rec);
  for (const [key, rec] of r) {
    const old = merged.get(key);
    merged.set(key, old ? winner(old, rec) : rec);
  }
  const records = [...merged.values()].sort((a, b) => compareText(a.key, b.key));
  const changedLocal = records.filter((m) => !same(l.get(m.key), m)).map((m) => m.key);
  const changedRemote = records.filter((m) => !same(r.get(m.key), m)).map((m) => m.key);
  return { records, changedLocal, changedRemote, rejected };
}
