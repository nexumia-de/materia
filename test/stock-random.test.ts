// Seeded random worlds: the engine never claims a drink makeable when a
// required line is unsatisfied (independent naive evaluator), and the unlock
// ranking equals the brute-force count of adding each ingredient.
import { describe, expect, test } from 'vitest';
import {
  buildStockIndex,
  buildTree,
  makeableSpecs,
  unlockRanking,
  type StockMode,
  type StockSpec,
} from '../src/index';
import { bruteUnlock, candidatesOf, naiveMakeable } from './helpers/stock-oracle';
import { world } from './helpers/stock-world';

const seeds = Array.from({ length: 40 }, (_, i) => 1000 + i);
const modes: StockMode[] = ['strict', 'with-substitutes'];

describe.each(seeds)('world %i', (seed) => {
  const w = world(seed);
  const built = buildTree(w.ingredients);
  if (!built.ok) throw new Error(built.errors.map((e) => e.message).join('; '));
  const tree = built.tree;
  const index = buildStockIndex(tree, w.specs);

  test('makeable agrees with the naive evaluator in both modes', () => {
    for (const stock of w.stocks) {
      for (const mode of modes) {
        const report = makeableSpecs(index, stock, { mode, excludeStatuses: [] });
        expect(report.specs.length).toBe(w.specs.length);
        for (const r of report.specs) {
          const spec = index.specsById.get(r.specId) as StockSpec;
          const claims = r.status === 'makeable' || r.status === 'makeable-with-substitution';
          expect(claims, `${r.specId} ${mode}`).toBe(
            naiveMakeable(tree, w.specs, stock, spec, mode),
          );
          if (mode === 'strict') expect(r.status).not.toBe('makeable-with-substitution');
          if (r.status === 'missing') expect(r.missing.length).toBeGreaterThan(0);
        }
      }
    }
  });

  test('unlock ranking equals the brute-force count in both modes', () => {
    for (const stock of w.stocks.slice(0, 2)) {
      for (const mode of modes) {
        const result = unlockRanking(index, stock, { mode });
        const listed = new Map(result.ranking.map((c) => [c.ingredientId, c]));
        const twins = new Map(result.ranking.flatMap((c) => c.alsoBy.map((t) => [t, c] as const)));
        for (const id of candidatesOf(w.ingredients, stock)) {
          const brute = bruteUnlock(tree, w.specs, stock, id, mode);
          const entry = listed.get(id) ?? twins.get(id);
          expect(entry?.unlocks ?? [], `${id} ${mode}`).toEqual(brute);
        }
        // Deterministic: same input, same output, whatever the order of the inputs.
        const again = unlockRanking(
          buildStockIndex(tree, [...w.specs].reverse()),
          [...stock].reverse(),
          { mode },
        );
        expect(again).toEqual(result);
      }
    }
  });
});
