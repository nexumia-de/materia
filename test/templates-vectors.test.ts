// Runs every vector in vectors/templates/ (matchTemplates, fillSlots,
// findVariants) on the neutral domain of vectors/templates/world.json.
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';
import {
  buildTree,
  fillSlots,
  findVariants,
  matchTemplates,
  type BaseIngredient,
  type LineMeasure,
  type MatchSpec,
  type Template,
  type VariantDomain,
} from '../src/index';
import { validate } from './helpers/json-schema';

type Role = 'main' | 'accent' | 'filler';
interface TestTemplate extends Template<Role> {
  klass?: string;
}

const dir = fileURLToPath(new URL('../vectors/templates/', import.meta.url));
const read = (name: string) => JSON.parse(readFileSync(`${dir}${name}`, 'utf8'));
const schema = read('templates-vector.schema.json');
const world = read('world.json') as {
  ingredients: (BaseIngredient & { role?: Role })[];
  templates: TestTemplate[];
};
const files = readdirSync(dir).filter(
  (f) => f.endsWith('.json') && !f.includes('schema') && f !== 'world.json',
);

const built = buildTree(world.ingredients);
if (!built.ok) throw new Error(built.errors.map((e) => e.message).join('; '));
const tree = built.tree;

// The measure of a line is its amount; counted lines have none.
const measure: LineMeasure<Role> = (line) =>
  line.unit === 'count' ? { reason: 'counted-without-volume' } : { value: line.amount };
const domain: VariantDomain<Role, TestTemplate> = {
  referenceRole: 'main',
  variantClass: (t) => t.klass,
  classes: ['lite'],
  replacedRole: 'main',
};
const templateOf = (id: string) => world.templates.find((t) => t.id === id) as TestTemplate;

interface Vector {
  id: string;
  kind: 'match' | 'fill' | 'variants';
  spec: MatchSpec<Role>;
  wanted?: string;
  templateId?: string;
  expected: Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
}

test('every kind has vectors and every file has its id as name', () => {
  const vectors = files.map((f) => read(f) as Vector);
  expect(new Set(vectors.map((v) => v.kind))).toEqual(new Set(['match', 'fill', 'variants']));
  for (const [i, f] of files.entries()) expect((vectors[i] as Vector).id + '.json').toBe(f);
});

describe('the neutral domain', () => {
  test('its tree and templates are valid', () => {
    expect(world.templates.length).toBeGreaterThanOrEqual(4);
    for (const t of world.templates) {
      expect(t.parentId === undefined || world.templates.some((p) => p.id === t.parentId)).toBe(
        true,
      );
    }
  });
});

describe.each(files)('%s', (file) => {
  const v = read(file) as Vector;
  test('matches the vector schema', () => {
    expect(validate(schema, v as never)).toEqual([]);
  });
  test('the function reproduces the expected values', () => {
    if (v.kind === 'match') {
      const result = matchTemplates(tree, world.templates, v.spec, measure, domain, v.wanted);
      const { candidates, ...rest } = v.expected;
      expect(result).toMatchObject(rest);
      if (!('chosen' in rest)) expect(result.chosen).toBeUndefined();
      expect(result.candidates.map((c) => c.templateId)).toEqual(
        candidates.map((c: { templateId: string }) => c.templateId),
      );
      expect(result.candidates).toMatchObject(candidates);
    } else if (v.kind === 'fill') {
      const result = fillSlots(tree, templateOf(v.templateId as string), v.spec.lines, measure);
      const { fills, ...rest } = v.expected;
      expect(result).toMatchObject(rest);
      expect(result.fills).toMatchObject(fills);
    } else {
      const result = findVariants(tree, world.templates, v.spec, measure, domain);
      const { variants, ...rest } = v.expected;
      expect(result).toMatchObject(rest);
      if (!('templateId' in rest)) expect(result.templateId).toBeUndefined();
      expect(
        result.variants.map(({ template, ...others }) => ({ templateId: template.id, ...others })),
      ).toEqual(variants);
    }
  });
});

// Numbers are ranges, not verdicts: the template code and its vectors never
// call a result good or wrong (the apps' rule; Mixtura checked this folder
// before it moved here).
test('no verdict words in the template code or vectors', () => {
  const words = ['good', 'bad', 'wrong', 'balanced', 'verdict', 'ideal', 'perfect', 'correct'];
  const base = fileURLToPath(new URL('../', import.meta.url));
  const sources = ['src/templates', 'vectors/templates'].flatMap((folder) =>
    readdirSync(`${base}${folder}`).map((f) => `${base}${folder}/${f}`),
  );
  expect(sources.length).toBeGreaterThan(5);
  for (const f of sources) {
    const text = readFileSync(f, 'utf8').toLowerCase();
    for (const w of words) expect(text, `${f}: ${w}`).not.toMatch(new RegExp(`\\b${w}\\b`));
  }
});
