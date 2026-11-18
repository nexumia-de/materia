// Installs this checkout into an empty project the way an app does (npm
// pack runs `prepare`, the tarball holds only dist/) and imports the entry.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const root = join(import.meta.dirname, '..');
const dir = mkdtempSync(join(tmpdir(), 'materia-consumer-'));
const run = (cmd, args, cwd) => execFileSync(cmd, args, { cwd, stdio: 'inherit' });

run('npm', ['pack', '--pack-destination', dir], root);
const tarball = readdirSync(dir).find((name) => name.endsWith('.tgz'));
if (!tarball) throw new Error('npm pack wrote no tarball');

writeFileSync(
  join(dir, 'package.json'),
  '{ "name": "consumer", "private": true, "type": "module" }\n',
);
run('npm', ['install', '--no-audit', '--no-fund', `./${tarball}`], dir);
writeFileSync(
  join(dir, 'use.mjs'),
  [
    "import * as materia from '@nexumia-de/materia';",
    "for (const name of ['buildTree', 'makeableSpecs', 'expiry', 'buildFamily', 'matchTemplates']) {",
    "  if (typeof materia[name] !== 'function') throw new Error(`missing export ${name}`);",
    '}',
    'console.log(`${Object.keys(materia).length} exports`);',
    '',
  ].join('\n'),
);
run(process.execPath, ['use.mjs'], dir);
