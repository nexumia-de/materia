// Version numbers that clash after a merge (docs/modules.md):
// versions of one lineage are written once and never changed, but two
// devices can each create "version 4" while offline.

import { instantMs } from '../sync/instant';

/** What the rule needs to know about a stored version. */
export interface VersionRef {
  id: string;
  lineageId: string;
  version: number;
  createdAt: string;
}

const order = (a: VersionRef, b: VersionRef): number => {
  const ta = instantMs(a.createdAt) ?? Infinity;
  const tb = instantMs(b.createdAt) ?? Infinity;
  if (ta !== tb) return ta < tb ? -1 : 1;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
};

/**
 * Finds the versions that share a number inside one lineage and gives all
 * but the earliest-created of each number a new one. The record created
 * earlier keeps its number (an unreadable `createdAt` sorts last, ties go by
 * id as text); the others get the numbers above the lineage's highest
 * existing number, in that same order. Only reports the changes; what else a
 * spec holds is for the caller.
 * @param versions The stored versions of any lineages, in any order.
 * @returns The renumbering as `{ id, from, to }`, sorted by lineage, then new
 * number; empty when no two versions of a lineage share a number.
 */
export function renumberClashes(
  versions: readonly VersionRef[],
): { id: string; from: number; to: number }[] {
  const lineages = new Map<string, VersionRef[]>();
  for (const v of versions) lineages.set(v.lineageId, [...(lineages.get(v.lineageId) ?? []), v]);
  const out: { lineageId: string; id: string; from: number; to: number }[] = [];
  for (const [lineageId, list] of lineages) {
    const byNumber = new Map<number, VersionRef[]>();
    for (const v of list) byNumber.set(v.version, [...(byNumber.get(v.version) ?? []), v]);
    const losers: VersionRef[] = [];
    for (const group of byNumber.values()) losers.push(...group.sort(order).slice(1));
    let next = Math.max(...list.map((v) => v.version));
    for (const v of losers.sort(order)) {
      next += 1;
      out.push({ lineageId, id: v.id, from: v.version, to: next });
    }
  }
  out.sort((a, b) =>
    a.lineageId < b.lineageId ? -1 : a.lineageId > b.lineageId ? 1 : a.to - b.to,
  );
  return out.map(({ id, from, to }) => ({ id, from, to }));
}
