// Runs every vector in vectors/specs/: the difference of two versions, the
// family of a spec, loops of riffs and the list of changes of a riff.
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';
import {
  buildFamily,
  diffVersions,
  findFamilyCycles,
  summariseRiff,
  type DiffDomain,
  type DiffOptionsOf,
  type FamilySpec,
  type VersionLine,
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
const files = readdirSync(dir).filter((f) => f.endsWith('.json'));

interface Vector {
  id: string;
  kind: 'diff' | 'family' | 'cycles' | 'riff-change';
  title: string;
  roles?: Record<string, string>;
  before?: TestSpec;
  after?: TestSpec;
  specs?: FamilySpec[];
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
    new Set(['diff', 'family', 'cycles', 'riff-change']),
  );
  for (const [i, f] of files.entries()) expect((vectors[i] as Vector).id + '.json').toBe(f);
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
