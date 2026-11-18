// Runs vectors/shelf (expiry of a made batch, the limiting shelf life of nested
// prepared ingredients) and checks the date arithmetic.
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';
import {
  addDays,
  buildTree,
  dayNumber,
  daysBetween,
  expiry,
  limitingShelfLife,
  type BaseIngredient,
} from '../src/index';
import { validate } from './helpers/json-schema';

const read = (p: string) => JSON.parse(readFileSync(p, 'utf8'));
const folder = (name: string) => fileURLToPath(new URL(`../vectors/${name}/`, import.meta.url));
const load = (name: string) => {
  const dir = folder(name);
  return {
    dir,
    schema: read(`${dir}${name}-vector.schema.json`),
    vectors: readdirSync(dir)
      .filter((f) => f.endsWith('.json') && !f.includes('schema'))
      .map((f) => ({ file: f, v: read(`${dir}${f}`) })),
  };
};

describe('shelf vectors', () => {
  const { schema, vectors } = load('shelf');
  test('they validate and carry their file name as id', () => {
    expect(vectors.length).toBeGreaterThanOrEqual(4);
    for (const { file, v } of vectors) {
      expect(validate(schema, v), file).toEqual([]);
      expect(`${v.id}.json`).toBe(file);
    }
  });
  test('there are vectors for both kinds', () => {
    expect(new Set(vectors.map((x) => x.v.kind))).toEqual(new Set(['expiry', 'limiting']));
  });
  for (const { file, v } of vectors) {
    describe(file, () => {
      if (v.kind === 'expiry') {
        for (const c of v.cases as {
          name: string;
          input: Parameters<typeof expiry>[0];
          expected: unknown;
        }[]) {
          test(c.name, () => expect(expiry(c.input)).toEqual(c.expected));
        }
      } else {
        const built = buildTree(v.ingredients as BaseIngredient[]);
        if (!built.ok) throw new Error(built.errors.map((e) => e.message).join('; '));
        const specs = new Map(Object.entries(v.specs as Record<string, never>));
        for (const c of v.cases as { name: string; id: string; expected: unknown }[]) {
          test(c.name, () =>
            expect(limitingShelfLife(built.tree, specs, c.id)).toEqual(c.expected),
          );
        }
      }
    });
  }
});

describe('date arithmetic', () => {
  test('real dates only', () => {
    expect(dayNumber('2026-02-29')).toBeUndefined();
    expect(dayNumber('2028-02-29')).toBeDefined();
    expect(dayNumber('2026-2-9')).toBeUndefined();
  });
  test('add and difference agree', () => {
    expect(addDays('2026-11-17', 0)).toBe('2026-11-17');
    expect(addDays('2026-11-17', 14)).toBe('2026-12-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(daysBetween('2026-11-17', '2026-12-01')).toBe(14);
    expect(daysBetween('2026-12-01', '2026-11-17')).toBe(-14);
    expect(addDays('2026-11-17', 1.5)).toBeUndefined();
  });
});

describe('date arithmetic against the platform calendar', () => {
  test('every day from 1900 to 2100 round-trips and agrees with Date', () => {
    const start = Date.UTC(1900, 0, 1) / 86_400_000;
    for (let n = start; n < start + 73_000; n += 1) {
      const iso = new Date(n * 86_400_000).toISOString().slice(0, 10);
      expect(dayNumber(iso)).toBe(n);
      expect(addDays('1970-01-01', n)).toBe(iso);
    }
  });
});
