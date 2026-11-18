// Runs every vector in vectors/stock/ (makeable and unlock) and checks every
// unlock run against the brute-force oracle (docs/makeable.md#vectors).
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';
import {
  buildStockIndex,
  buildTree,
  makeableSpecs,
  missingOne,
  pairRanking,
  unlockRanking,
  type Ingredient,
  type StockEntry,
  type StockOptions,
  type StockSpec,
} from '../src/index';
import { validate } from './helpers/json-schema';
import { bruteUnlock, candidatesOf, naiveMakeable, pairMismatches } from './helpers/stock-oracle';

const dir = fileURLToPath(new URL('../vectors/stock/', import.meta.url));
const read = (name: string) => JSON.parse(readFileSync(`${dir}${name}`, 'utf8'));
const schema = read('stock-vector.schema.json');
const files = readdirSync(dir).filter((f) => f.endsWith('.json') && !f.includes('schema'));

interface Run {
  stock: StockEntry[];
  options: StockOptions & { limit?: number };
  order?: string[];
  expected: Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
}
interface Vector {
  id: string;
  kind: 'makeable' | 'unlock' | 'pairs';
  ingredients: Ingredient[];
  specs: StockSpec[];
  runs: Run[];
}

test('there are vectors for both kinds and every file has its id as name', () => {
  const vectors = files.map((f) => read(f) as Vector);
  expect(new Set(vectors.map((v) => v.kind))).toEqual(new Set(['makeable', 'unlock', 'pairs']));
  for (const [i, f] of files.entries()) expect((vectors[i] as Vector).id + '.json').toBe(f);
});

describe.each(files)('%s', (file) => {
  const v = read(file) as Vector;
  const built = buildTree(v.ingredients);
  if (!built.ok) throw new Error(built.errors.map((e) => e.message).join('; '));
  const tree = built.tree;
  const index = buildStockIndex(tree, v.specs);

  test('matches the vector schema', () => {
    expect(validate(schema, read(file))).toEqual([]);
  });

  test.each(v.runs.map((r, i) => [i, r] as const))('run %i', (_i, run) => {
    if (v.kind === 'makeable') {
      const report = makeableSpecs(index, run.stock, run.options);
      const { specs: wanted, missingOne: one, ...rest } = run.expected;
      expect(report).toMatchObject(rest);
      for (const [id, expected] of Object.entries(wanted ?? {})) {
        expect(
          report.specs.find((s) => s.specId === id),
          id,
        ).toMatchObject(expected as object);
      }
      if (run.order) expect(report.specs.map((s) => s.specId)).toEqual(run.order);
      if (one) expect(missingOne(index, report)).toEqual(one);
      return;
    }
    if (v.kind === 'pairs') {
      const result = pairRanking(index, run.stock, run.options);
      expect(result).toMatchObject(run.expected);
      // Every pair of candidates equals adding both and recomputing.
      const cands = candidatesOf(v.ingredients, run.stock);
      const pairs = cands.flatMap((a, i) => cands.slice(i + 1).map((b) => [a, b] as const));
      const full = pairRanking(index, run.stock, { ...run.options, limit: 1e9 });
      expect(
        pairMismatches(tree, v.specs, run.stock, full, pairs, run.options.excludeStatuses),
      ).toEqual([]);
      return;
    }
    const result = unlockRanking(index, run.stock, run.options);
    expect(result).toMatchObject(run.expected);
    // The result equals adding each candidate and recomputing.
    const mode = result.mode;
    const listed = new Map(result.ranking.map((c) => [c.ingredientId, c]));
    for (const c of result.ranking) {
      expect(c.unlocks, c.ingredientId).toEqual(
        bruteUnlock(tree, v.specs, run.stock, c.ingredientId, mode, run.options.excludeStatuses),
      );
      for (const twin of c.alsoBy) {
        expect(
          bruteUnlock(tree, v.specs, run.stock, twin, mode, run.options.excludeStatuses),
          twin,
        ).toEqual(c.unlocks);
      }
    }
    const folded = new Set(result.ranking.flatMap((c) => c.alsoBy));
    for (const id of candidatesOf(v.ingredients, run.stock)) {
      if (listed.has(id) || folded.has(id)) continue;
      expect(
        bruteUnlock(tree, v.specs, run.stock, id, mode, run.options.excludeStatuses),
        `${id} unlocks nothing`,
      ).toEqual([]);
    }
  });

  test('makeable status agrees with the naive evaluator in both modes', () => {
    for (const run of v.runs) {
      for (const mode of ['strict', 'with-substitutes'] as const) {
        const report = makeableSpecs(index, run.stock, { mode, excludeStatuses: [] });
        for (const r of report.specs) {
          const spec = index.specsById.get(r.specId) as StockSpec;
          const claims = r.status === 'makeable' || r.status === 'makeable-with-substitution';
          expect(claims, `${r.specId} ${mode}`).toBe(
            naiveMakeable(tree, v.specs, run.stock, spec, mode),
          );
        }
      }
    }
  });
});
