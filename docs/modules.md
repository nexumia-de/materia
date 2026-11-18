---
type: Specification
title: Modules
description: What materia holds (ingredient tree, templates with slots, specs and versions, stock, shelf life), its public entry, the parameters a domain passes in, and what stays in the apps.
tags: [model, api, modules]
generated: { by: claude-code/2.1.327, at: 2026-11-18 }
---

# Modules

materia is the part of Mixtura's engine that knows no drink rule. It
was moved here on 2026-11-18 so that Culina can use it without copying
it. Everything is a pure function over plain data.

| Folder (`src/`) | What it does                                                                                                                                              |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ingredients/`  | The ingredient tree with levels, queries, cost, inherited properties, substitution classes, swap candidates, prepared ingredients with nesting and cycles |
| `templates/`    | Templates with role slots: lines to slots by role, ratios of measured slots against a reference role, ranking, variants by a class                        |
| `specs/`        | Versions of a spec: diff of two versions, families of riffs, cycles, the summary of what a riff changed                                                   |
| `stock/`        | What the stock allows: makeable specs with substitution, missing one, which ingredient or pair unlocks the most                                           |
| `shelf/`        | Whole-day calendar arithmetic, expiry states, the limiting shelf life of a prepared ingredient                                                            |
| `sync/`         | Pure parts of stock sync: record merge with tombstones, places and the combined view, place document, envelope, storage port, plan ([sync](sync.md))      |

The folders import only each other; `src/index.ts` is the one public
entry and the package's contract. `test/public-api.test.ts` pins its
list of values.

# What a domain passes in

The general functions take the parts that differ between drinks and
food as parameters:

| Function                                      | The app passes                                                                            |
| --------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `inheritedValue`, `resolveAllOf`              | which properties are inherited and which are computed when prepared                       |
| `resolvePrepared`                             | a fold that computes a prepared ingredient's properties from its lines                    |
| `fillSlots`, `matchTemplates`, `findVariants` | the measure of a line (volume, mass), the reference role, the class that chooses variants |
| `diffVersions`                                | the spec fields to compare and the line fields that count as the amount                   |

Roles are strings; the types are generic in the role id, the
ingredient and the template, so an app narrows them to its own shapes.

# What is not here

- **Units and amounts.** Parsing, converting, scaling and formatting
  amounts and the unit table stay in Mixtura; materia has no unit
  system until a second app needs the same one.
- **Volume names.** Some general types still carry names from the drink
  side (`PreparedLine.ml`, `SlotFill.ml`, `MatchLine.topMl`, the
  volume reasons of `UnmeasuredReason`). They were moved as they are so
  that Mixtura's public API did not change; they are renamed when Culina
  needs a mass measure.
- **Export and import** of an app's data, and every rule of one domain
  (ABV, dilution, yields, baker's percentages).
- **Storage, network, clock.** The apps own them and pass values in.
