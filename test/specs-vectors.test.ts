// Runs every vector in vectors/specs/: the difference of two versions, the
// family of a spec, loops of riffs and the list of changes of a riff.
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';
import { validate } from './helpers/json-schema';
import {
  buildFamily,
  diffVersions,
  findFamilyCycles,
  renumberClashes,
  summariseRiff,
  type DiffDomain,
  type DiffOptionsOf,
  type FamilySpec,
  type VersionLine,
  type VersionRef,
  type VersionSpec,
} from '../src/index';

// The fields a domain compares beside the lines; the drink fields of Mixtura
// are used so the shared vectors pass unchanged.
interface TestLine extends VersionLine {
  topMl?: number;
}
interface TestSpec extends VersionSpec<TestLine> {
  method?: string;
  glass?: string;
  garnish?: string;
}
const DOMAIN: DiffDomain<TestLine, TestSpec, string> = {
  fields: [
    ['name', (s) => s.name],
    ['template', (s) => s.templateId],
    ['method', (s) => s.method],
    ['glass', (s) => s.glass],
    ['garnish', (s) => s.garnish?.trim()],
    ['notes', (s) => s.notes?.trim()],
  ],
  amountKeys: ['topMl'],
};
const diffSpecs = (before: TestSpec, after: TestSpec, options: DiffOptionsOf<TestLine> = {}) =>
  diffVersions(before, after, options, DOMAIN);

const dir = fileURLToPath(new URL('../vectors/specs/', import.meta.url));
const read = (name: string) => JSON.parse(readFileSync(`${dir}${name}`, 'utf8'));
const files = readdirSync(dir).filter((f) => f.endsWith('.json') && !f.includes('schema'));
const schema = read('specs-vector.schema.json');

interface Vector {
  id: string;
  kind: 'diff' | 'family' | 'cycles' | 'riff-change' | 'renumber';
  title: string;
  roles?: Record<string, string>;
  before?: TestSpec;
  after?: TestSpec;
  specs?: FamilySpec[];
  versions?: VersionRef[];
  lineageId?: string;
  diffFrom?: string;
  expected: any; // eslint-disable-line @typescript-eslint/no-explicit-any
}

const diffOf = (v: Vector) =>
  diffSpecs(v.before as TestSpec, v.after as TestSpec, {
    roleOf: (line) => v.roles?.[line.ingredientId],
  });

test('every kind has vectors and every file has its id as name', () => {
  const vectors = files.map((f) => read(f) as Vector);
  expect(new Set(vectors.map((v) => v.kind))).toEqual(
    new Set(['diff', 'family', 'cycles', 'riff-change', 'renumber']),
  );
  for (const [i, f] of files.entries()) {
    expect((vectors[i] as Vector).id + '.json').toBe(f);
    expect(validate(schema, vectors[i] as never), f).toEqual([]);
  }
});

describe.each(files)('%s', (file) => {
  const v = read(file) as Vector;
  test(v.title, () => {
    if (v.kind === 'diff') expect(diffOf(v)).toMatchObject(v.expected);
    if (v.kind === 'family') {
      const family = buildFamily(v.specs as FamilySpec[], v.lineageId as string);
      expect(family).toMatchObject(v.expected);
      if (!('cycle' in v.expected)) expect(family.cycle).toBeUndefined();
      if (!('missingParent' in v.expected)) expect(family.missingParent).toBeUndefined();
    }
    if (v.kind === 'renumber')
      expect(renumberClashes(v.versions as VersionRef[])).toEqual(v.expected);
    if (v.kind === 'cycles') expect(findFamilyCycles(v.specs as FamilySpec[])).toEqual(v.expected);
    if (v.kind === 'riff-change') {
      const source = read(`${v.diffFrom}.json`) as Vector;
      const change = summariseRiff(diffOf(source));
      expect(change).toMatchObject(v.expected);
      expect(change.items).toHaveLength(change.count);
    }
  });
});

test('diff is deterministic in the order of lines: changed and added in the newer order, removed last', () => {
  const d = diffSpecs(
    {
      lines: [
        { ingredientId: 'a', amount: 1, unit: 'ml' },
        { ingredientId: 'b', amount: 1, unit: 'ml' },
      ],
    },
    {
      lines: [
        { ingredientId: 'c', amount: 1, unit: 'ml' },
        { ingredientId: 'b', amount: 2, unit: 'ml' },
      ],
    },
  );
  expect(d.lines.map((l) => l.kind)).toEqual(['added', 'changed', 'removed']);
});

describe('renumberClashes properties', () => {
  // A small seeded generator (mulberry32): the tests must not use Math.random.
  const seeded = (seed: number) => {
    let s = seed >>> 0;
    return (n: number) => {
      s = (s + 0x6d2b79f5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return Math.floor((((t ^ (t >>> 14)) >>> 0) / 4294967296) * n);
    };
  };
  const times = ['2026-11-18T10:00:00Z', '2026-11-18T10:00:00.5Z', '2026-11-18T10:05:00Z', 'bad'];
  const generate = (pick: (n: number) => number): VersionRef[] =>
    Array.from({ length: pick(9) }, (_, i) => ({
      id: `v${i}`,
      lineageId: ['A', 'B'][pick(2)] as string,
      version: 1 + pick(4),
      createdAt: times[pick(times.length)] as string,
    }));
  const shuffled = <T>(list: T[], pick: (n: number) => number): T[] => {
    const out = [...list];
    for (let i = out.length - 1; i > 0; i--) {
      const j = pick(i + 1);
      [out[i], out[j]] = [out[j] as T, out[i] as T];
    }
    return out;
  };
  test('the result does not depend on the input order', () => {
    const pick = seeded(11);
    for (let n = 0; n < 300; n++) {
      const versions = generate(pick);
      expect(renumberClashes(shuffled(versions, pick)), `generated ${n}`).toEqual(
        renumberClashes(versions),
      );
    }
  });
  test('applying the result leaves no clash, and keeps what did not clash', () => {
    const pick = seeded(12);
    for (let n = 0; n < 300; n++) {
      const versions = generate(pick);
      const changes = renumberClashes(versions);
      const to = new Map(changes.map((c) => [c.id, c.to]));
      const after = versions.map((v) => ({ ...v, version: to.get(v.id) ?? v.version }));
      expect(renumberClashes(after), `generated ${n}`).toEqual([]);
      const keys = after.map((v) => `${v.lineageId}/${v.version}`);
      expect(new Set(keys).size, `generated ${n}`).toBe(keys.length);
    }
  });
});
