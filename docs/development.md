---
type: Guide
title: Development
description: Setup, commands, layout, the purity rule and its three guards, vectors, how the apps install the package from a git tag, releasing, and CI.
tags: [development, tooling, ci, release]
generated: { by: claude-code/2.1.327, at: 2026-11-18 }
---

# Development

## Setup

Node 22 (`.nvmrc`). The rules import phosh-toolkit's core rules by a
relative path, so check out
[phosh-toolkit](https://github.com/nexumia-de/phosh-toolkit) beside
this repository.

```sh
npm ci
```

```sh
npm run check
```

`npm run check` is format, lint, typecheck, tests and build; run it
before every commit. One test file: `npx vitest run test/<file>`.

## Layout

| Path                         | What                                                                 |
| ---------------------------- | -------------------------------------------------------------------- |
| `src/index.ts`               | The public entry, an explicit list ([modules](modules.md))           |
| `src/<folder>/`              | One folder per module                                                |
| `test/`                      | Vitest; tests import the package only from `../src/index`            |
| `vectors/`                   | Test vectors as JSON, one case per file, with a schema per folder    |
| `build.mjs`                  | Bundle, declarations and the bundle check; runs as `prepare`         |
| `check-dist.mjs`             | What the built bundle must not contain                               |
| `scripts/consumer-check.mjs` | Packs the checkout, installs it into an empty project and imports it |

## Purity

The package has no clock, no randomness, no host API and no logging.
Three guards:

1. ESLint rules on `src/**/*.ts` (`eslint.config.js`).
2. `test/purity.test.ts` lints fixtures that must fail, so the rules
   cannot be removed silently.
3. `build.mjs` fails when `dist/materia.mjs` contains an import, a DOM
   or Node-only name, `Date`, `performance`, `crypto` or
   `Math.random`. Strings and comments are not stripped, so a false
   positive means rewording the source.

## Adding a rule

Write the vector first (`vectors/<folder>/<case>.json`), then the code,
and run the vector through the public entry. A new export goes into
`src/index.ts` and the pinned list in `test/public-api.test.ts`, and
gets a line in [the log](log.md).

## How the apps install it

There is no registry. An app names a version tag:

```json
"@nexumia-de/materia": "github:nexumia-de/materia#v0.1.0"
```

npm clones the repository at that tag, installs the development
packages, runs `prepare` (`node build.mjs`) and packs `dist/`. The
app's lockfile records the commit. `dist/` is never committed.

## Releasing

1. `version` in `package.json` is the next version, in the pull
   request that needs it.
2. After the merge the owner tags that commit `v<version>`. Agents ask
   for the tag and do not set it.
3. Each app bumps the tag in its own pull request (Dependabot proposes
   it for version-like tags).

A change of the public entry that breaks an app raises the minor
version while the major is 0.

## CI

`.github/workflows/ci.yml`, on pull requests and pushes to `main`:

| Job                | What                                                                                               |
| ------------------ | -------------------------------------------------------------------------------------------------- |
| `check`            | `npm run check`                                                                                    |
| `install-from-git` | `scripts/consumer-check.mjs`: pack with `prepare`, install into an empty project, import the entry |

Dependabot opens weekly pull requests for npm packages and actions.
`main` has no ruleset yet; the owner imports one as in the other
repositories (phosh-toolkit `docs/branch-protection.md`), with `check`
and `install-from-git` as required checks.
