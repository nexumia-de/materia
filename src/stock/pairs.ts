// Which two ingredients to add to the stock together make the most specs
// makeable (docs/makeable.md#pairs).
import { distance, type Id } from '../ingredients/index';
import { evaluate } from './evaluation';
import { linePool, lineFixedBy } from './pair-fixers';
import { evaluateSpec, keptSpecs } from './makeable';
import type { StockEntry, StockIndex, StockLine, StockMode, StockOptions } from './types';

export interface PairOptions extends StockOptions {
  /** How many pairs to return, best first. Default 20. */
  limit?: number;
}

export interface PairCandidate {
  /** The two ingredients, `first` before `second` by id. */
  first: Id;
  second: Id;
  firstKind: 'product' | 'type';
  secondKind: 'product' | 'type';
  /** Specs that become makeable by adding both; sorted. */
  unlocks: Id[];
  count: number;
  /** Specs the first ingredient makes makeable alone. */
  byFirst: Id[];
  /** Specs the second ingredient makes makeable alone. */
  bySecond: Id[];
  /** Specs that become makeable only with both. `count` = `byFirst` ∪ `bySecond` plus these. */
  together: Id[];
  /** Distinct templates of the specs in `unlocks`. */
  templates: number;
  /** Sum of both tree distances to the nearest ingredient in stock; null when nothing is in stock. */
  stockDistance: number | null;
  /** Descendants of each that behave exactly the same (listed, not ranked). */
  alsoByFirst: Id[];
  alsoBySecond: Id[];
}

export interface PairResult {
  mode: StockMode;
  /** Number of pairs that qualify (both ingredients add something to the other). */
  total: number;
  /** The best `limit` pairs ordered by count, templates, distance, first id, second id. */
  ranking: PairCandidate[];
}

const byText = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);
const SHIFT = 2 ** 20;
const setBit = (bits: Uint32Array, o: number): void => {
  bits[o >>> 5] = (bits[o >>> 5] as number) | (1 << (o & 31));
};
const popcount = (n: number): number => {
  n -= (n >>> 1) & 0x55555555;
  n = (n & 0x33333333) + ((n >>> 2) & 0x33333333);
  return (((n + (n >>> 4)) & 0x0f0f0f0f) * 0x01010101) >>> 24;
};

/**
 * Ranks pairs of ingredients not in stock by the specs they make makeable together.
 *
 * Only specs that are not makeable matter. Per such spec the ingredients that
 * could take part (`linePool`) give the singles that finish it alone and the
 * pairs that finish it only together; the pairs are then scored from bitsets
 * of the per-ingredient unlocks. A pair is listed when each member adds
 * something to the other (`count` exceeds both single counts).
 *
 * @param index - The stock index of the tree and specs (`buildStockIndex`).
 * @param stock - Stock records.
 * @param options - `mode`, `excludeStatuses` as for `unlockRanking`; `limit` (default 20).
 * @returns The mode, the number of qualifying pairs and the best `limit` of them.
 */
export function pairRanking(
  index: StockIndex,
  stock: readonly StockEntry[],
  options?: PairOptions,
): PairResult {
  const mode = options?.mode ?? 'strict';
  const limit = Math.max(1, Math.floor(options?.limit ?? 20));
  const { ev } = evaluate(index, stock);

  const ids: Id[] = [];
  const num = new Map<Id, number>();
  const idx = (id: Id): number => {
    let n = num.get(id);
    if (n === undefined) {
      n = ids.length;
      num.set(id, n);
      ids.push(id);
    }
    return n;
  };
  const openSpecs: { id: Id; templateId?: Id }[] = [];
  const singles: number[][] = []; // per open spec ordinal: ingredients that finish it alone
  const together = new Map<number, number[]>(); // pair key -> spec ordinals

  for (const spec of keptSpecs(index, options)) {
    const result = evaluateSpec(ev, spec, mode);
    if (result.status !== 'missing') continue;
    const lines: StockLine[] = spec.lines.filter((_, i) => {
      const line = result.lines[i];
      return line && !line.satisfied && !line.optional;
    });
    const pools = lines.map((l) => {
      const pool = new Set<Id>();
      linePool(ev, l, mode, pool);
      for (const s of ev.stocked) pool.delete(s);
      return pool;
    });
    const all = new Set(pools.flatMap((p) => [...p]));
    const ordinal = openSpecs.length;
    const fixes = (added: Set<Id>) => lines.every((l) => lineFixedBy(ev, l, mode, added));
    const alone = [...all].filter((a) => fixes(new Set([a])));
    const isAlone = new Set(alone);
    const first = pools.reduce((a, b) => (b.size < a.size ? b : a), pools[0] as Set<Id>);
    const seen = new Set<string>();
    const spans: [Id, Id][] = [];
    for (const a of first) {
      if (isAlone.has(a)) continue;
      for (const b of all) {
        if (b === a || isAlone.has(b)) continue;
        const [x, y] = a < b ? [a, b] : [b, a];
        const k = `${x}\u0000${y}`;
        if (seen.has(k)) continue;
        seen.add(k);
        if (fixes(new Set([a, b]))) spans.push([x, y]);
      }
    }
    if (alone.length === 0 && spans.length === 0) continue;
    openSpecs.push({ id: spec.id, templateId: spec.templateId });
    singles.push(alone.map(idx));
    for (const [x, y] of spans) {
      const [i, j] = [idx(x), idx(y)];
      const key = Math.min(i, j) * SHIFT + Math.max(i, j);
      const list = together.get(key);
      if (list) list.push(ordinal);
      else together.set(key, [ordinal]);
    }
  }

  const words = Math.ceil(openSpecs.length / 32);
  const alone = ids.map(() => new Uint32Array(words));
  singles.forEach((list, ordinal) => {
    for (const c of list) setBit(alone[c] as Uint32Array, ordinal);
  });
  const size = alone.map((u) => u.reduce((s, w) => s + popcount(w), 0));

  // Fold a descendant into its nearest ancestor among the candidates when both
  // behave the same: same single unlocks, same partners with the same specs.
  const partners = ids.map(() => [] as string[]);
  for (const [key, list] of together) {
    const i = Math.floor(key / SHIFT);
    const j = key % SHIFT;
    (partners[i] as string[]).push(`${j}:${list.join(',')}`);
    (partners[j] as string[]).push(`${i}:${list.join(',')}`);
  }
  const keyOf = ids.map(
    (_, c) =>
      `${[...(alone[c] as Uint32Array)].join(',')}|${(partners[c] as string[]).sort().join(';')}`,
  );
  const folded = new Map<number, number>();
  ids.forEach((id, c) => {
    let up = index.tree.byId.get(id)?.parentId;
    while (up !== undefined && !num.has(up)) up = index.tree.byId.get(up)?.parentId;
    const p = up === undefined ? undefined : num.get(up);
    if (p !== undefined && keyOf[p] === keyOf[c]) folded.set(c, p);
  });
  const twins = new Map<number, Id[]>();
  for (const c of folded.keys()) {
    let root = folded.get(c) as number;
    while (folded.has(root)) root = folded.get(root) as number;
    twins.set(root, [...(twins.get(root) ?? []), ids[c] as Id]);
  }
  const reps = ids.map((_, c) => c).filter((c) => !folded.has(c));

  const found: { i: number; j: number; count: number }[] = [];
  for (let a = 0; a < reps.length; a++) {
    const i = reps[a] as number;
    const ui = alone[i] as Uint32Array;
    for (let b = a + 1; b < reps.length; b++) {
      const j = reps[b] as number;
      const uj = alone[j] as Uint32Array;
      let union = 0;
      for (let w = 0; w < words; w++) union += popcount((ui[w] as number) | (uj[w] as number));
      const count = union + (together.get(Math.min(i, j) * SHIFT + Math.max(i, j))?.length ?? 0);
      if (count > (size[i] as number) && count > (size[j] as number)) found.push({ i, j, count });
    }
  }
  found.sort((a, b) => b.count - a.count);
  const cut = found[Math.min(limit, found.length) - 1]?.count ?? 0;
  const shortlist = found.filter((f) => f.count >= cut);

  const stockIds = [...ev.stocked];
  const dist = new Map<number, number | null>();
  const distOf = (c: number): number | null => {
    if (!dist.has(c)) {
      const d = stockIds.map((s) => distance(index.tree, ids[c] as Id, s) as number);
      dist.set(c, d.length ? Math.min(...d) : null);
    }
    return dist.get(c) as number | null;
  };
  const specIds = (bits: Uint32Array | number[]): Id[] => {
    const out: Id[] = [];
    openSpecs.forEach((s, o) => {
      if ((((bits[o >>> 5] as number) >>> (o & 31)) & 1) === 1) out.push(s.id);
    });
    return out.sort(byText);
  };
  const kind = (c: number) => (index.levelOf(ids[c] as Id) === 'product' ? 'product' : 'type');
  const sums = new Map<PairCandidate, number>();
  const entries = shortlist.map(({ i, j, count }): PairCandidate => {
    const [f, s] = (ids[i] as Id) < (ids[j] as Id) ? [i, j] : [j, i];
    const both = together.get(Math.min(i, j) * SHIFT + Math.max(i, j)) ?? [];
    const bits = new Uint32Array(words);
    const [uf, us] = [alone[f] as Uint32Array, alone[s] as Uint32Array];
    for (let w = 0; w < words; w++) bits[w] = (uf[w] as number) | (us[w] as number);
    for (const o of both) setBit(bits, o);
    const unlocks = specIds(bits);
    const df = distOf(f);
    const ds = distOf(s);
    const templates = new Set(
      unlocks.map((u) => index.specsById.get(u)?.templateId).filter((t) => t !== undefined),
    ).size;
    const entry: PairCandidate = {
      first: ids[f] as Id,
      second: ids[s] as Id,
      firstKind: kind(f),
      secondKind: kind(s),
      unlocks,
      count,
      byFirst: specIds(alone[f] as Uint32Array),
      bySecond: specIds(alone[s] as Uint32Array),
      together: both.map((o) => (openSpecs[o] as { id: Id }).id).sort(byText),
      templates,
      stockDistance: df === null || ds === null ? null : df + ds,
      alsoByFirst: [...(twins.get(f) ?? [])].sort(byText),
      alsoBySecond: [...(twins.get(s) ?? [])].sort(byText),
    };
    sums.set(entry, df === null || ds === null ? Infinity : df + ds);
    return entry;
  });
  entries.sort(
    (a, b) =>
      b.count - a.count ||
      b.templates - a.templates ||
      (sums.get(a) as number) - (sums.get(b) as number) ||
      byText(a.first, b.first) ||
      byText(a.second, b.second),
  );
  const ranking = entries.slice(0, limit);
  return { mode, total: found.length, ranking };
}
