---
type: Reference
title: Dependencies
description: Every dependency of materia with exact version, licence and use; the package has no runtime dependency.
tags: [dependencies, licences]
generated: { by: claude-code/2.1.327, at: 2026-11-18 }
---

# Dependencies

materia is AGPL-3.0-or-later ([LICENSE](../LICENSE)). It has **no
runtime dependency**: `dist/materia.mjs` is one file without imports,
and the apps bundle it. Versions are pinned exactly in `package.json`,
the same ones as in Mixtura; the lockfile pins the rest. Licences read
from each package's `package.json` in `node_modules`.

## Development only

| Package             | Version | Licence    | Use                                           |
| ------------------- | ------- | ---------- | --------------------------------------------- |
| `esbuild`           | 0.28.2  | MIT        | Bundles `dist/materia.mjs` (in `prepare`)     |
| `typescript`        | 6.0.3   | Apache-2.0 | Type checking and declarations (in `prepare`) |
| `vitest`            | 5.1.0   | MIT        | Tests                                         |
| `eslint`            | 10.14.0 | MIT        | Lint, the purity rule                         |
| `@eslint/js`        | 10.0.1  | MIT        | Lint rules                                    |
| `typescript-eslint` | 8.72.2  | MIT        | Lint for TypeScript                           |
| `globals`           | 17.14.0 | MIT        | Lint globals for scripts                      |
| `prettier`          | 3.9.10  | MIT        | Formatting                                    |
| `@types/node`       | 22.20.5 | MIT        | Types for tests and build scripts             |

An app that installs the package from a git tag runs `prepare`, and npm
installs these development packages for that step; none of them ends up
in the app.

## GitHub Actions

| Action               | Version | Use                      |
| -------------------- | ------- | ------------------------ |
| `actions/checkout`   | v7.0.1  | Checkout in CI           |
| `actions/setup-node` | v7.1.0  | Node and npm cache in CI |

Both are pinned to a commit SHA in `.github/workflows/ci.yml`.

## Data

None. The vectors in `vectors/` were written for Mixtura and for this
package; they are AGPL-3.0-or-later like the code.
