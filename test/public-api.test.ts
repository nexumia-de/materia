// The tests reach the package only through the public entry, and the entry
// exports exactly the pinned list of values.
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { expect, test } from 'vitest';
import * as api from '../src/index';

const dir = fileURLToPath(new URL('./', import.meta.url));
const tests = readdirSync(dir).filter((f) => f.endsWith('.test.ts') && f !== 'public-api.test.ts');
const helpers = readdirSync(`${dir}helpers`)
  .filter((f) => f.endsWith('.ts'))
  .map((f) => `helpers/${f}`);

test.each([...tests, ...helpers])('%s imports the package from the entry point only', (f) => {
  const text = readFileSync(`${dir}${f}`, 'utf8');
  const imports = [...text.matchAll(/from '((?:\.\.\/)+src[^']*)'/g)].map((m) => m[1] as string);
  // purity.test.ts, check-dist.test.ts and the schema helper do not use the package.
  if (['purity.test.ts', 'check-dist.test.ts', 'helpers/json-schema.ts'].includes(f))
    return expect(imports).toEqual([]);
  expect(imports.length, f).toBeGreaterThan(0);
  for (const path of imports) expect(path, f).toMatch(/^(\.\.\/)+src\/index$/);
});

test('the test list covers every test file', () => {
  expect(tests.length).toBeGreaterThanOrEqual(8);
});

test('the entry exports exactly the pinned values', () => {
  expect(Object.keys(api).sort()).toEqual(
    [
      'ancestors',
      'buildTree',
      'descendants',
      'distance',
      'getIngredient',
      'isA',
      'PREPARED_FIELDS',
      'resolveCost',
      'sameClass',
      'substitutesFor',
      'swapCandidates',
      'inheritedValue',
      'resolveAllOf',
      'resolvePrepared',
      'lineRole',
      'fillSlots',
      'matchTemplates',
      'findVariants',
      'buildFamily',
      'findFamilyCycles',
      'summariseRiff',
      'diffVersions',
      'buildStockIndex',
      'makeableSpecs',
      'missingOne',
      'pairRanking',
      'unlockRanking',
      'addDays',
      'dayNumber',
      'daysBetween',
      'expiry',
      'limitingShelfLife',
      'USE_SOON_DAYS',
      'buildDocument',
      'buildEnvelope',
      'combinePlaces',
      'DOCUMENT_FORMAT',
      'DOCUMENT_VERSION',
      'ENVELOPE_FORMAT',
      'ENVELOPE_VERSION',
      'envelopeAad',
      'instantMs',
      'mergePlace',
      'mergeRecords',
      'parseDocument',
      'parseEnvelope',
      'planSync',
    ].sort(),
  );
});
