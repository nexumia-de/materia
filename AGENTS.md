@../phosh-toolkit/agents/core.md

# materia

The general model shared by the nexumia-de web apps
[Mixtura](https://github.com/nexumia-de/mixtura) (drinks) and
[Culina](https://github.com/nexumia-de/culina) (cooking): the ingredient
tree, templates with role slots, versioned specs, stock and shelf life,
and the general parts of stock sync. One npm package,
`@nexumia-de/materia`, that the apps install from a git tag. Knowledge
of this repository: [docs/index.md](docs/index.md).

materia is a library, not an app; the GTK rules do not apply.

## Rules

- **Nothing of one domain.** No units, no drink rules (ABV, dilution),
  no kitchen rules (yields, baker's percentages). What a domain brings
  comes in as a parameter: roles, measures, compared fields, inherited
  properties.
- **Pure.** No clock, no randomness, no host API, no logging; time
  comes in as input. The lint rule, `test/purity.test.ts` and the check
  of the built bundle keep it so.
- **No runtime dependency.** The apps bundle the package; `prepare`
  builds `dist/` on install.
- **Every rule has a test vector** in `vectors/`, run through the
  public entry `src/index.ts` only.
- **Code moves here when a second app needs it, never in advance.**
- **The public entry is a contract.** The apps pin an exact tag; a
  removed or changed export needs a new version and a line in
  `docs/log.md`. The owner sets the tags; ask when one is needed.
- Examples in vectors may name drinks or food; rules may not.

## Before committing

1. `npm run check` passes (format, lint, typecheck, tests, build).
2. `docs/` updated in the same commit.
