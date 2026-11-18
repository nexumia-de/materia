// Which ingredient to add to the stock to make the most specs makeable
// (docs/makeable.md#unlock-ranking).
import { distance, type Id } from '../ingredients/index';
import { evaluate } from './evaluation';
import { intersect, lineFixers } from './fixers';
import { evaluateSpec, keptSpecs } from './makeable';
import type {
  SpecResult,
  StockEntry,
  StockIndex,
  StockMode,
  StockOptions,
  StockSpec,
} from './types';

export interface UnlockCandidate {
  ingredientId: Id;
  /** `product` for a product, `type` for a type or a category (any one product of it will do). */
  kind: 'product' | 'type';
  /** Specs that become makeable in the mode asked for, by adding only this ingredient; sorted. */
  unlocks: Id[];
  count: number;
  /** Specs that become makeable in strict mode. */
  strict: Id[];
  /** Specs that are makeable only with a substitute once it is added: they are not makeable now, even with substitutes. */
  withSubstitution: Id[];
  /** Distinct templates of the specs in `unlocks` (specs without a template do not count). */
  templates: number;
  /** Tree distance to the nearest ingredient in stock; null when nothing is in stock. */
  stockDistance: number | null;
  /** Descendants that unlock exactly the same specs; buying any of them is as good (listed here, not ranked). */
  alsoBy: Id[];
}

export interface NeedsMore {
  specId: Id;
  /** Ingredients to acquire (more than one, or no single ingredient completes them). */
  missing: Id[];
  count: number;
}

export interface UnlockResult {
  mode: StockMode;
  /** Candidates ordered by count, then templates, then distance to the stock, then id. */
  ranking: UnlockCandidate[];
  /** Specs not makeable that no single ingredient unlocks; ordered by count of missing, then id. */
  needsMore: NeedsMore[];
  /** Specs blocked by an ingredient that is not in the tree. */
  unknown: { specId: Id; ids: Id[] }[];
}

const byText = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

function fixersOf(
  ev: ReturnType<typeof evaluate>['ev'],
  spec: StockSpec,
  result: SpecResult,
  mode: StockMode,
): Set<Id> {
  const open = spec.lines.filter((_, i) => {
    const line = result.lines[i];
    return line && !line.satisfied && !line.optional;
  });
  const fixed = intersect(open.map((l) => lineFixers(ev, l, mode)));
  for (const id of ev.stocked) fixed.delete(id);
  return fixed;
}

const push = (map: Map<Id, Id[]>, key: Id, value: Id) => {
  const list = map.get(key);
  if (list) list.push(value);
  else map.set(key, [value]);
};

/**
 * Ranks the ingredients not in stock by the specs each would make makeable on its own.
 *
 * @param index - The stock index of the tree and specs (`buildStockIndex`).
 * @param stock - Stock records.
 * @param options - `mode` (default `strict`) decides what counts as makeable; `excludeStatuses` (default retired).
 * @returns Ranked candidates with the spec ids they unlock (strict and only-with-substitution), specs needing more than one ingredient, and specs blocked by unknown ingredients.
 */
export function unlockRanking(
  index: StockIndex,
  stock: readonly StockEntry[],
  options?: StockOptions,
): UnlockResult {
  const mode = options?.mode ?? 'strict';
  const { ev } = evaluate(index, stock);
  const strictBy = new Map<Id, Id[]>();
  const subBy = new Map<Id, Id[]>();
  const open: { spec: StockSpec; result: SpecResult }[] = [];
  const unknown: UnlockResult['unknown'] = [];
  for (const spec of keptSpecs(index, options)) {
    const strict = evaluateSpec(ev, spec, 'strict');
    const sub = evaluateSpec(ev, spec, 'with-substitutes');
    const chosen = mode === 'strict' ? strict : sub;
    if (chosen.status === 'unknown-ingredient')
      unknown.push({ specId: spec.id, ids: chosen.unknown });
    if (chosen.status === 'missing') open.push({ spec, result: chosen });
    if (strict.status === 'missing') {
      for (const id of fixersOf(ev, spec, strict, 'strict')) push(strictBy, id, spec.id);
    }
    if (sub.status === 'missing') {
      for (const id of fixersOf(ev, spec, sub, 'with-substitutes')) push(subBy, id, spec.id);
    }
  }

  const templateOf = (specId: Id) => index.specsById.get(specId)?.templateId;
  const stockIds = [...ev.stocked];
  const all: UnlockCandidate[] = [];
  for (const id of new Set([...strictBy.keys(), ...subBy.keys()])) {
    const strict = (strictBy.get(id) ?? []).sort(byText);
    const subUnlock = (subBy.get(id) ?? []).sort(byText);
    const inStrict = new Set(strict);
    const unlocks = mode === 'strict' ? strict : subUnlock;
    if (unlocks.length === 0) continue;
    const dists = stockIds.map((s) => distance(index.tree, id, s) as number);
    all.push({
      ingredientId: id,
      kind: index.levelOf(id) === 'product' ? 'product' : 'type',
      unlocks,
      count: unlocks.length,
      strict,
      withSubstitution: subUnlock.filter((s) => !inStrict.has(s)),
      templates: new Set(unlocks.map(templateOf).filter((t) => t !== undefined)).size,
      stockDistance: dists.length ? Math.min(...dists) : null,
      alsoBy: [],
    });
  }

  // A descendant that unlocks exactly what its nearest candidate ancestor
  // unlocks is folded into it: any product of the type does the same.
  const byId = new Map(all.map((c) => [c.ingredientId, c]));
  const key = (c: UnlockCandidate) =>
    `${c.strict.join(',')}|${c.withSubstitution.join(',')}|${c.unlocks.join(',')}`;
  const folded = new Map<Id, Id>();
  for (const c of all) {
    let up = index.tree.byId.get(c.ingredientId)?.parentId;
    while (up !== undefined && !byId.has(up)) up = index.tree.byId.get(up)?.parentId;
    const parent = up === undefined ? undefined : byId.get(up);
    if (parent && key(parent) === key(c)) folded.set(c.ingredientId, parent.ingredientId);
  }
  for (const [child, first] of folded) {
    let root = first;
    while (folded.has(root)) root = folded.get(root) as Id;
    (byId.get(root) as UnlockCandidate).alsoBy.push(child);
  }
  const ranking = all
    .filter((c) => !folded.has(c.ingredientId))
    .map((c) => ({ ...c, alsoBy: c.alsoBy.sort(byText) }));
  const rank = (n: number | null) => (n === null ? Infinity : n);
  ranking.sort(
    (a, b) =>
      b.count - a.count ||
      b.templates - a.templates ||
      rank(a.stockDistance) - rank(b.stockDistance) ||
      byText(a.ingredientId, b.ingredientId),
  );

  const unlocked = new Set(all.flatMap((c) => c.unlocks));
  const needsMore = open
    .filter((o) => !unlocked.has(o.spec.id))
    .map((o) => ({ specId: o.spec.id, missing: o.result.missing, count: o.result.missing.length }))
    .sort((a, b) => a.count - b.count || byText(a.specId, b.specId));
  return { mode, ranking, needsMore, unknown };
}
