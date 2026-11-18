// The bundle check flags use of host globals and lets the same words pass
// as property names and inside strings.
import { expect, test } from 'vitest';
import { checkDist } from '../check-dist.mjs';

test.each([
  ['document.title', 'a DOM or browser name'],
  ['const w = window.innerWidth;', 'a DOM or browser name'],
  ['navigator?.onLine', 'a DOM or browser name'],
  ['await fetch(url)', 'a network call'],
  ['new Date()', 'a clock or randomness'],
  ['Math.random()', 'a clock or randomness'],
  ["import x from 'y';", 'an import'],
  ['process.env.X', 'a Node-only name'],
])('%s is flagged', (source, what) => {
  expect(checkDist(source)).toContain(`contains ${what}`);
});

test.each([
  'return { ok: true, document: doc };',
  'const place = result.document.place;',
  "return { ok: false, error: 'not-a-document' };",
  'plan.fetch(1);',
  '// src/sync/document.ts',
  'export const one = 1;',
])('%s passes', (source) => {
  expect(checkDist(source)).toEqual([]);
});
