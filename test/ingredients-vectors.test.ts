// Runs every vector in vectors/ingredients/ against the general ingredient
// functions, and tests resolvePrepared with a fold of its own.
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';
import {
  ancestors,
  buildTree,
  descendants,
  distance,
  inheritedValue,
  isA,
  resolveCost,
  resolvePrepared,
  sameClass,
  substitutesFor,
  swapCandidates,
  type BaseIngredient,
  type IngredientTreeOf,
  type PreparedFold,
  type PreparedSpec,
} from '../src/index';
import { validate } from './helpers/json-schema';

// The vectors carry the drink properties abv, sugar and acid; a domain adds
// such fields to the general ingredient and names which are computed.
interface TestIngredient extends BaseIngredient {
  abv?: number;
  sugar?: number;
  acid?: number;
}
const COMPUTED_WHEN_PREPARED = ['abv', 'sugar', 'acid'];

const dir = fileURLToPath(new URL('../vectors/ingredients/', import.meta.url));
const read = (name: string) => JSON.parse(readFileSync(`${dir}${name}`, 'utf8'));
const vectorSchema = read('ingredient-vector.schema.json');
const files = readdirSync(dir).filter((f) => f.endsWith('.json') && !f.includes('schema'));

interface Vector {
  id: string;
  kind: string;
  ingredients: TestIngredient[];
  expected: Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
  queries?: { id: string; role?: string; expected: Record<string, any> }[]; // eslint-disable-line @typescript-eslint/no-explicit-any
}

function treeOf(v: Vector): IngredientTreeOf<TestIngredient> {
  const built = buildTree(v.ingredients);
  if (!built.ok) throw new Error(built.errors.map((e) => e.message).join('; '));
  return built.tree;
}

const shape = (r: { value: unknown; from?: string; reason?: string }) =>
  r.value === undefined ? { missing: r.reason } : { value: r.value, from: r.from };

test('there is a vector for every kind of rule', () => {
  const kinds = new Set(files.map((f) => read(f).kind));
  expect([...kinds].sort()).toEqual(
    ['inheritance', 'substitution', 'swap-candidates', 'tree-errors', 'tree-queries'].sort(),
  );
});

describe.each(files)('%s', (file) => {
  const v = read(file) as Vector;

  test('has the vector shape', () => {
    expect(validate(vectorSchema, v as never)).toEqual([]);
    expect(v.id).toBe(file.replace(/\.json$/, ''));
  });

  test('the functions reproduce the expected values', () => {
    if (v.kind === 'tree-errors') {
      const built = buildTree(v.ingredients);
      expect(built.ok).toBe(false);
      if (built.ok) return;
      expect(built.errors.map((e) => ({ code: e.code, ids: e.ids }))).toEqual(v.expected.errors);
      for (const e of built.errors) for (const id of e.ids) expect(e.message).toContain(id);
    } else if (v.kind === 'inheritance') {
      const tree = treeOf(v);
      for (const q of v.queries ?? []) {
        for (const [prop, want] of Object.entries(q.expected)) {
          const got =
            prop === 'cost'
              ? resolveCost(tree, q.id)
              : inheritedValue(tree, q.id, prop as keyof TestIngredient, COMPUTED_WHEN_PREPARED);
          expect(shape(got), `${q.id}.${prop}`).toEqual(want);
        }
      }
    } else if (v.kind === 'tree-queries') {
      const tree = treeOf(v);
      for (const [id, want] of Object.entries(v.expected.ancestors)) {
        expect(ancestors(tree, id) ?? null).toEqual(want);
      }
      for (const [id, want] of Object.entries(v.expected.descendants)) {
        expect(descendants(tree, id) ?? null).toEqual(want);
      }
      for (const c of v.expected.isA) expect(isA(tree, c.child, c.ancestor)).toBe(c.result);
      for (const c of v.expected.distance) {
        expect(distance(tree, c.a, c.b) ?? null).toBe(c.result);
        expect(distance(tree, c.b, c.a) ?? null).toBe(c.result);
      }
    } else if (v.kind === 'substitution') {
      const tree = treeOf(v);
      for (const [id, want] of Object.entries(v.expected.substitutesFor)) {
        expect(substitutesFor(tree, id), id).toEqual(want);
      }
      for (const c of v.expected.sameClass) {
        expect(sameClass(tree, c.a, c.b)).toBe(c.result);
        expect(sameClass(tree, c.b, c.a)).toBe(c.result);
      }
    } else {
      const tree = treeOf(v);
      for (const q of v.queries ?? []) {
        const { role } = q;
        expect(swapCandidates(tree, q.id, role ? { role } : {}), `${q.id} ${role ?? ''}`).toEqual(
          q.expected,
        );
      }
    }
  });
});

test('a prepared ingredient never inherits a computed property from its ancestors', () => {
  const built = buildTree<TestIngredient>([
    { id: 'syrup', name: 'Syrup', level: 'category', sugar: 60, shelfLifeDays: 30 },
    {
      id: 'mine',
      name: 'Mine',
      level: 'type',
      parentId: 'syrup',
      prepared: { specId: 's', yield: { amount: 1, unit: 'l' } },
    },
  ]);
  if (!built.ok) throw new Error('tree');
  expect(inheritedValue(built.tree, 'mine', 'sugar', COMPUTED_WHEN_PREPARED).value).toBeUndefined();
  expect(inheritedValue(built.tree, 'mine', 'shelfLifeDays', COMPUTED_WHEN_PREPARED)).toEqual({
    value: 30,
    from: 'syrup',
  });
});

describe('resolvePrepared', () => {
  const prepared = (specId: string) => ({ specId, yield: { amount: 1, unit: 'l' } });
  const built = buildTree<BaseIngredient>([
    { id: 'thing', name: 'Thing', level: 'category' },
    { id: 'water', name: 'Water', level: 'type', parentId: 'thing' },
    { id: 'sugar', name: 'Sugar', level: 'type', parentId: 'thing' },
    { id: 'syrup', name: 'Syrup', level: 'type', parentId: 'thing', prepared: prepared('syrup') },
    {
      id: 'cordial',
      name: 'Cordial',
      level: 'type',
      parentId: 'thing',
      prepared: prepared('cordial'),
    },
    {
      id: 'loop-a',
      name: 'Loop A',
      level: 'type',
      parentId: 'thing',
      prepared: prepared('loop-a'),
    },
    {
      id: 'loop-b',
      name: 'Loop B',
      level: 'type',
      parentId: 'thing',
      prepared: prepared('loop-b'),
    },
    { id: 'orphan', name: 'Orphan', level: 'type', parentId: 'thing', prepared: prepared('nope') },
  ]);
  if (!built.ok) throw new Error('tree');
  const tree = built.tree;
  const line = (ingredientId: string, ml: number) => ({ ingredientId, ml });
  const specs = new Map<string, PreparedSpec>([
    ['syrup', { lines: [line('sugar', 100), line('water', 100)] }],
    ['cordial', { lines: [line('syrup', 50), line('water', 25), line('ghost', 5)] }],
    ['loop-a', { lines: [line('loop-b', 1)] }],
    ['loop-b', { lines: [line('loop-a', 1)] }],
  ]);
  // The fold: a raw ingredient is worth its id length; a prepared one is the
  // sum of the values of its lines, or -1 when the spec is unknown.
  const fold: PreparedFold<number> = {
    raw: (id) => id.length,
    prepared: (_id, spec, parts) =>
      spec ? parts.reduce<number>((sum, p) => sum + (p ?? 0), 0) : -1,
  };

  test('folds a flat spec over the lines in order', () => {
    // sugar (5) + water (5)
    expect(resolvePrepared(tree, specs, 'syrup', fold)).toEqual({ value: 10, errors: [] });
  });

  test('walks nested prepared ingredients and reports an unknown line ingredient', () => {
    // syrup (10) + water (5) + ghost (unknown, counted as 0)
    const r = resolvePrepared(tree, specs, 'cordial', fold);
    expect(r.value).toBe(15);
    expect(r.errors.map((e) => ({ code: e.code, ids: e.ids }))).toEqual([
      { code: 'unknown-ingredient', ids: ['cordial', 'ghost'] },
    ]);
  });

  test('the fold sees the parts in line order with undefined for a failed line', () => {
    const seen: (readonly (number | undefined)[])[] = [];
    resolvePrepared(tree, specs, 'cordial', {
      raw: fold.raw,
      prepared: (id, spec, parts) => {
        if (id === 'cordial') seen.push(parts);
        return fold.prepared(id, spec, parts);
      },
    });
    expect(seen).toEqual([[10, 5, undefined]]);
  });

  test('a cycle is reported once, with the ids around it', () => {
    const r = resolvePrepared(tree, specs, 'loop-a', fold);
    expect(r.errors.map((e) => ({ code: e.code, ids: e.ids }))).toEqual([
      { code: 'prepared-cycle', ids: ['loop-a', 'loop-b', 'loop-a'] },
    ]);
    expect(r.errors[0]?.message).toContain('loop-a -> loop-b -> loop-a');
  });

  test('an unknown spec is reported and the fold still runs with no spec', () => {
    const r = resolvePrepared(tree, specs, 'orphan', fold);
    expect(r.value).toBe(-1);
    expect(r.errors.map((e) => ({ code: e.code, ids: e.ids }))).toEqual([
      { code: 'unknown-spec', ids: ['orphan', 'nope'] },
    ]);
  });

  test('an unknown ingredient and a non-prepared ingredient have no value', () => {
    const unknown = resolvePrepared(tree, specs, 'nothing', fold);
    expect(unknown.value).toBeUndefined();
    expect(unknown.errors.map((e) => e.code)).toEqual(['unknown-ingredient']);
    const raw = resolvePrepared(tree, specs, 'water', fold);
    expect(raw.value).toBeUndefined();
    expect(raw.errors.map((e) => e.code)).toEqual(['not-prepared']);
  });

  test('errors met twice are listed once', () => {
    const twice = new Map(specs).set('syrup', {
      lines: [line('ghost', 1), line('ghost', 2)],
    });
    expect(resolvePrepared(tree, twice, 'syrup', fold).errors).toHaveLength(1);
  });
});
