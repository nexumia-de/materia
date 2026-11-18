// Builds the package: one dependency-free ES module (dist/materia.mjs), the
// declarations (dist/index.d.ts and one file per module) and a check that the
// bundle has no DOM, Node-only, clock or randomness reference. Runs as
// `prepare`, so an app that installs the package from a git tag gets dist/.
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { readFileSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { build } from 'esbuild';
import { checkDist } from './check-dist.mjs';

const root = import.meta.dirname;
const out = join(root, 'dist');
rmSync(out, { recursive: true, force: true });

await build({
  absWorkingDir: root,
  entryPoints: ['src/index.ts'],
  outfile: join(out, 'materia.mjs'),
  bundle: true,
  format: 'esm',
  platform: 'neutral',
  target: 'es2022',
  legalComments: 'none',
  logLevel: 'warning',
});

// Resolved, not a fixed path: as a git dependency the build tools may sit in
// a parent node_modules.
const tsc = createRequire(import.meta.url).resolve('typescript/bin/tsc');
execFileSync(process.execPath, [tsc, '-p', 'tsconfig.build.json', '--outDir', out], {
  cwd: root,
  stdio: 'inherit',
});

const problems = checkDist(readFileSync(join(out, 'materia.mjs'), 'utf8'));
if (problems.length > 0) {
  throw new Error(`dist/materia.mjs is not pure:\n${problems.join('\n')}`);
}
console.log(`${String(statSync(join(out, 'materia.mjs')).size).padStart(8)}  materia.mjs`);
