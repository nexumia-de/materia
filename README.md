# materia

The general model behind [Mixtura](https://github.com/nexumia-de/mixtura)
(a workbench for mixed drinks) and
[Culina](https://github.com/nexumia-de/culina) (a cook's notebook):
ingredients in a tree with roles and substitutes, templates with role
slots and ratio matching, versioned specs with diffs and families, what
your stock allows, and shelf life. Pure TypeScript functions, no runtime
dependency, no domain rules.

## Use

The package is not on a registry. Install it from a version tag; its
`prepare` script builds it:

```json
{
  "dependencies": {
    "@nexumia-de/materia": "github:nexumia-de/materia#v0.1.0"
  }
}
```

```ts
import { buildTree, makeableSpecs } from '@nexumia-de/materia';
```

What is in it: [docs/modules.md](docs/modules.md). How to work on it:
[docs/development.md](docs/development.md).

## Licence

AGPL-3.0-or-later, see [LICENSE](LICENSE).
