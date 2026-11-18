// What the stock allows: a result per spec, and the specs that miss one
// ingredient (docs/makeable.md).
import type { Id } from '../ingredients/index';
import { evaluate, type Evaluation } from './evaluation';
import { satisfyLine } from './satisfies';
import type {
  MakeableReport,
  MissingOne,
  SpecResult,
  StockEntry,
  StockIndex,
  StockMode,
  StockOptions,
  StockSpec,
} from './types';

const byText = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

/** The specs the options keep, in spec id order. */
export function keptSpecs(index: StockIndex, options: StockOptions | undefined): StockSpec[] {
  const excluded = options?.excludeStatuses ?? ['retired'];
  return index.specs.filter((s) => !excluded.includes(s.status ?? 'on-menu'));
}

/** Result of one spec against an evaluated stock. */
export function evaluateSpec(ev: Evaluation, spec: StockSpec, mode: StockMode): SpecResult {
  const lines = spec.lines.map((line) => satisfyLine(ev, line, mode));
  const required = lines.filter((l) => !l.optional);
  const unknown = [
    ...new Set(
      required.filter((l) => l.reason === 'unknown-ingredient').map((l) => l.ingredientId),
    ),
  ].sort(byText);
  const missing = [...new Set(required.filter((l) => !l.satisfied).flatMap((l) => l.missing))].sort(
    byText,
  );
  const open = required.some((l) => !l.satisfied);
  const status =
    unknown.length > 0
      ? 'unknown-ingredient'
      : open
        ? 'missing'
        : required.some((l) => l.substituted)
          ? 'makeable-with-substitution'
          : 'makeable';
  return { specId: spec.id, status, mode, lines, missing, unknown };
}

/**
 * Which specs the stock allows.
 *
 * @param index - The stock index of the tree and specs (`buildStockIndex`).
 * @param stock - Stock records (`present` or not; no quantities).
 * @param options - `mode` (default `strict`) and `excludeStatuses` (default retired).
 * @returns One result per spec ordered by id: status, per line how it is satisfied or why not, ingredients to acquire, unknown ingredients; the mode used is stated.
 */
export function makeableSpecs(
  index: StockIndex,
  stock: readonly StockEntry[],
  options?: StockOptions,
): MakeableReport {
  const mode = options?.mode ?? 'strict';
  const { ev, ignored } = evaluate(index, stock);
  return {
    mode,
    specs: keptSpecs(index, options).map((s) => evaluateSpec(ev, s, mode)),
    ignoredStock: ignored,
  };
}

/**
 * Specs that miss exactly one ingredient.
 *
 * @param index - The stock index used for the report.
 * @param report - The result of `makeableSpecs`.
 * @returns Specs with status `missing` and one ingredient to acquire, ordered by spec id, with the substitutes of that ingredient (listed by the spec, then by class).
 */
export function missingOne(index: StockIndex, report: MakeableReport): MissingOne[] {
  const out: MissingOne[] = [];
  for (const result of report.specs) {
    if (result.status !== 'missing' || result.missing.length !== 1) continue;
    const missing = result.missing[0] as Id;
    const spec = index.specsById.get(result.specId);
    const listed = (spec?.lines ?? [])
      .filter((l) => l.ingredientId === missing)
      .flatMap((l) => (l.substitutes ?? []).map((s) => s.ingredientId))
      .filter((id) => index.tree.byId.has(id));
    const substitutes = [...new Set([...listed, ...index.substitutesOf(missing)])];
    out.push({ specId: result.specId, missing, substitutes });
  }
  return out;
}
