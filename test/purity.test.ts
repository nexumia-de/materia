// The purity rule of eslint.config.js must fail on these fixtures, so it
// cannot be removed without a red test. The fixtures are linted as if they
// were source files of the package.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { ESLint } from 'eslint';
import { expect, test } from 'vitest';

const root = fileURLToPath(new URL('../', import.meta.url));
const fixtures = fileURLToPath(new URL('./fixtures/', import.meta.url));
const eslint = new ESLint({ cwd: root });

async function messages(source: string) {
  const [result] = await eslint.lintText(source, { filePath: `${root}src/probe.ts` });
  return result?.messages ?? [];
}

test.each([
  ['impure-clock', 'no-restricted-globals'],
  ['impure-dom', 'no-restricted-globals'],
  ['impure-random', 'no-restricted-syntax'],
])('%s fails the lint with %s', async (name, rule) => {
  const found = await messages(readFileSync(`${fixtures}${name}.ts.txt`, 'utf8'));
  expect(found.map((m) => m.ruleId)).toContain(rule);
});

test('console is forbidden', async () => {
  const found = await messages('export const log = (): void => console.log(1);\n');
  expect(found.map((m) => m.ruleId)).toContain('no-console');
});

test('pure code passes', async () => {
  expect(await messages('export const one = (): number => 1;\n')).toEqual([]);
});
