// Seeded random worlds for the pair ranking: every listed pair and every
// qualifying pair of candidates equals the brute force of adding both
// (docs/makeable.md#pairs).
import { describe, expect, test } from 'vitest';
import { buildStockIndex, buildTree, pairRanking, type StockMode } from '../src/index';
import { candidatesOf, pairMismatches } from './helpers/stock-oracle';
import { rng, world } from './helpers/stock-world';

const seeds = Array.from({ length: 40 }, (_, i) => 1000 + i);
const modes: StockMode[] = ['strict', 'with-substitutes'];

describe.each(seeds)('world %i', (seed) => {
  const w = world(seed);
  const built = buildTree(w.ingredients);
  if (!built.ok) throw new Error(built.errors.map((e) => e.message).join('; '));
  const tree = built.tree;
  const index = buildStockIndex(tree, w.specs);

  test('pair ranking equals the brute force in both modes', () => {
    const pick = rng(seed);
    for (const stock of w.stocks.slice(0, 2)) {
      const cands = candidatesOf(w.ingredients, stock);
      const all = cands.flatMap((a, i) => cands.slice(i + 1).map((b) => [a, b] as const));
      const sample = all.filter(() => pick() < 0.15);
      for (const mode of modes) {
        const result = pairRanking(index, stock, { mode, limit: 1e9 });
        expect(result.ranking.length).toBe(result.total);
        expect(pairMismatches(tree, w.specs, stock, result, sample), `${mode}`).toEqual([]);
        const again = pairRanking(
          buildStockIndex(tree, [...w.specs].reverse()),
          [...stock].reverse(),
          {
            mode,
            limit: 1e9,
          },
        );
        expect(again).toEqual(result);
        const top = pairRanking(index, stock, { mode, limit: 3 });
        expect(top.ranking).toEqual(result.ranking.slice(0, 3));
      }
    }
  });
});
