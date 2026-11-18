// Test-only oracles for the stock module: an independent, naive evaluator of
// "makeable" and a brute-force unlock count (add each ingredient to the
// stock, recompute, count). Public entry only.
import {
  buildStockIndex,
  makeableSpecs,
  substitutesFor,
  type Id,
  type Ingredient,
  type IngredientTree,
  type PairResult,
  type SpecStatus,
  type StockEntry,
  type StockMode,
  type StockSpec,
} from '../../src/index';

export const present = (...ids: Id[]): StockEntry[] =>
  ids.map((ingredientId) => ({ ingredientId, present: true }));

/** Naive definition of makeable, written separately from the engine: true when every required line is satisfied. */
export function naiveMakeable(
  tree: IngredientTree,
  specs: readonly StockSpec[],
  stock: readonly StockEntry[],
  spec: StockSpec,
  mode: StockMode,
): boolean {
  const have = new Set(stock.filter((s) => s.present).map((s) => s.ingredientId));
  const byId = new Map(specs.map((s) => [s.id, s]));
  const isBelow = (child: Id, top: Id): boolean => {
    for (let c: Id | undefined = child; c !== undefined; c = tree.byId.get(c)?.parentId) {
      if (c === top) return true;
    }
    return false;
  };
  const avail = (x: Id, m: StockMode, stack: Id[]): boolean => {
    if (have.has(x)) return true;
    const prep = tree.byId.get(x)?.prepared;
    if (!prep || stack.includes(x)) return false;
    const recipe = byId.get(prep.specId);
    if (!recipe) return false;
    return recipe.lines.every((l) => l.optional === true || lineOk(l, m, [...stack, x]));
  };
  const anyBelow = (top: Id, m: StockMode, stack: Id[]) =>
    tree.ids.some((c) => isBelow(c, top) && avail(c, m, stack));
  const lineOk = (l: StockSpec['lines'][number], m: StockMode, stack: Id[]): boolean => {
    if (!tree.byId.has(l.ingredientId)) return false;
    if (anyBelow(l.ingredientId, m, stack)) return true;
    if (m === 'strict') return false;
    return (
      (l.substitutes ?? []).some(
        (s) => tree.byId.has(s.ingredientId) && anyBelow(s.ingredientId, 'strict', stack),
      ) || substitutesFor(tree, l.ingredientId).ids.some((c) => avail(c, 'strict', stack))
    );
  };
  return spec.lines.every((l) => l.optional === true || lineOk(l, mode, []));
}

/** Specs makeable (status makeable, or with substitution when `mode` allows it) for a stock. */
export function makeableIds(
  tree: IngredientTree,
  specs: readonly StockSpec[],
  stock: readonly StockEntry[],
  mode: StockMode,
  excludeStatuses: readonly SpecStatus[] = ['retired'],
): Set<Id> {
  const index = buildStockIndex(tree, specs);
  const report = makeableSpecs(index, stock, { mode, excludeStatuses });
  return new Set(
    report.specs
      .filter((r) => r.status === 'makeable' || r.status === 'makeable-with-substitution')
      .map((r) => r.specId),
  );
}

/** Brute force: the specs that become makeable when only `candidate` is added to the stock. */
export function bruteUnlock(
  tree: IngredientTree,
  specs: readonly StockSpec[],
  stock: readonly StockEntry[],
  candidate: Id,
  mode: StockMode,
  excludeStatuses?: readonly SpecStatus[],
): Id[] {
  const before = makeableIds(tree, specs, stock, mode, excludeStatuses);
  const after = makeableIds(tree, specs, [...stock, ...present(candidate)], mode, excludeStatuses);
  return [...after].filter((id) => !before.has(id)).sort();
}

/** All ingredients not present in the stock. */
export function candidatesOf(
  ingredients: readonly Ingredient[],
  stock: readonly StockEntry[],
): Id[] {
  const have = new Set(stock.filter((s) => s.present).map((s) => s.ingredientId));
  return ingredients.map((i) => i.id).filter((id) => !have.has(id));
}

/** Brute force for a pair: what each ingredient unlocks alone, and what the two unlock together. */
export function brutePair(
  tree: IngredientTree,
  specs: readonly StockSpec[],
  stock: readonly StockEntry[],
  a: Id,
  b: Id,
  mode: StockMode,
  excludeStatuses?: readonly SpecStatus[],
): { byA: Id[]; byB: Id[]; both: Id[]; together: Id[] } {
  const before = makeableIds(tree, specs, stock, mode, excludeStatuses);
  const byA = bruteUnlock(tree, specs, stock, a, mode, excludeStatuses);
  const byB = bruteUnlock(tree, specs, stock, b, mode, excludeStatuses);
  const after = makeableIds(tree, specs, [...stock, ...present(a, b)], mode, excludeStatuses);
  const both = [...after].filter((id) => !before.has(id)).sort();
  const alone = new Set([...byA, ...byB]);
  return { byA, byB, both, together: both.filter((id) => !alone.has(id)) };
}

/**
 * Checks a pair ranking against `brutePair`: every listed pair equals the
 * brute force, and a pair that is not listed (neither itself nor through a
 * folded twin) is one where a member adds nothing to the other.
 * `pairs` limits which pairs of `candidates` are tried.
 */
export function pairMismatches(
  tree: IngredientTree,
  specs: readonly StockSpec[],
  stock: readonly StockEntry[],
  result: PairResult,
  pairs: readonly (readonly [Id, Id])[],
  excludeStatuses?: readonly SpecStatus[],
): string[] {
  const out: string[] = [];
  const rep = new Map<Id, Id>();
  for (const e of result.ranking) {
    for (const t of e.alsoByFirst) rep.set(t, e.first);
    for (const t of e.alsoBySecond) rep.set(t, e.second);
  }
  const listed = new Map(result.ranking.map((e) => [`${e.first}|${e.second}`, e]));
  for (const e of result.ranking) {
    const b = brutePair(tree, specs, stock, e.first, e.second, result.mode, excludeStatuses);
    const same =
      JSON.stringify([e.byFirst, e.bySecond, e.unlocks, e.together]) ===
      JSON.stringify([b.byA, b.byB, b.both, b.together]);
    if (!same || e.count !== b.both.length) out.push(`listed ${e.first}+${e.second} differs`);
    for (const t of [...e.alsoByFirst]) {
      const bt = brutePair(tree, specs, stock, t, e.second, result.mode, excludeStatuses);
      if (JSON.stringify(bt.both) !== JSON.stringify(b.both)) out.push(`twin ${t} differs`);
    }
  }
  for (const [x, y] of pairs) {
    const b = brutePair(tree, specs, stock, x, y, result.mode, excludeStatuses);
    const qualifies = b.both.length > b.byA.length && b.both.length > b.byB.length;
    const [p, q] = [rep.get(x) ?? x, rep.get(y) ?? y].sort();
    const entry = listed.get(`${p}|${q}`);
    if (entry) {
      if (!qualifies || entry.count !== b.both.length) out.push(`${x}+${y} listed wrongly`);
    } else if (qualifies && result.ranking.length < result.total) {
      // outside the limit: only the ordering would matter, not checked here
    } else if (qualifies) {
      out.push(`${x}+${y} qualifies but is missing`);
    }
  }
  return out;
}
