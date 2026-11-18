// Places: the name of a place merges like a record, and the union of ticked
// places is a derived view (docs/sync.md#places).

import { compareText } from './canonical';
import { instantMs } from './instant';
import { mergeRecords, type SyncRecord } from './records';

export interface Place {
  id: string;
  name: string;
  updatedAt: string;
}

const time = (p: Place): number => instantMs(p.updatedAt) ?? -Infinity;

/** Newest name wins; equal time: the greater name, then the greater timestamp text. */
function placeWinner(a: Place, b: Place): Place {
  if (time(a) !== time(b)) return time(a) > time(b) ? a : b;
  const byName = compareText(a.name, b.name);
  if (byName !== 0) return byName > 0 ? a : b;
  return compareText(a.updatedAt, b.updatedAt) >= 0 ? a : b;
}

const equal = (a: Place, b: Place): boolean =>
  a.id === b.id && a.name === b.name && a.updatedAt === b.updatedAt;

/** Merges two copies of one place (the id is the local one); newest name wins, ties as for records. */
export function mergePlace(
  local: Place,
  remote: Place,
): { place: Place; changedLocal: boolean; changedRemote: boolean } {
  const w = placeWinner(local, remote);
  const place = { id: local.id, name: w.name, updatedAt: w.updatedAt };
  return { place, changedLocal: !equal(place, local), changedRemote: !equal(place, remote) };
}

/** One entry of the combined view. */
export interface CombinedEntry<V> {
  key: string;
  holders: { placeId: string; value: V }[];
}

/**
 * The union of the ticked places. `byPlace` is a plain object from place id
 * to that place's records. For every key at least one ticked place holds a
 * live record of, one entry with the holders in the order of `ticked`
 * (a repeated id counts once, an unknown id holds nothing). Tombstones,
 * invalid records and unticked places do not count. Entries sorted by key.
 */
export function combinePlaces<V>(
  byPlace: Record<string, readonly SyncRecord<V>[]>,
  ticked: readonly string[],
): CombinedEntry<V>[] {
  const entries = new Map<string, CombinedEntry<V>>();
  for (const placeId of new Set(ticked)) {
    if (!Object.prototype.hasOwnProperty.call(byPlace, placeId)) continue;
    for (const rec of mergeRecords(byPlace[placeId] as readonly SyncRecord<V>[], []).records) {
      if (rec.deleted) continue;
      const entry = entries.get(rec.key) ?? { key: rec.key, holders: [] };
      entry.holders.push({ placeId, value: rec.value as V });
      entries.set(rec.key, entry);
    }
  }
  return [...entries.values()].sort((a, b) => compareText(a.key, b.key));
}
