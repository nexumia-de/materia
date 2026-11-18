// Which sets of ingredients, added to the stock together, satisfy a line that
// is not satisfied now. It mirrors fixers.ts (single ingredients) and
// satisfies.ts: a prepared ingredient with several missing parts is
// completed by a set that covers every missing part (docs/makeable.md#pairs).
import type { Id } from '../ingredients/index';
import type { Evaluation } from './evaluation';
import { preparedAvailability } from './prepared';
import type { StockLine, StockMode } from './types';

/** The open (unsatisfied, required) part lines of an incomplete prepared ingredient, or undefined when it cannot be completed by adding ingredients. */
function openParts(
  ev: Evaluation,
  id: Id,
  mode: StockMode,
  stack: readonly Id[],
): StockLine[] | undefined {
  if (ev.index.tree.byId.get(id)?.prepared === undefined || stack.includes(id)) return undefined;
  const made = preparedAvailability(ev, id, mode, stack);
  if (made.ok || made.reason !== 'incomplete') return undefined;
  const specId = ev.index.tree.byId.get(id)?.prepared?.specId;
  const spec = specId === undefined ? undefined : ev.index.specsById.get(specId);
  const isOpen = (i: number) => {
    const part = made.parts[i];
    return part !== undefined && !part.satisfied && !part.optional;
  };
  if (made.parts.some((p, i) => isOpen(i) && p.reason === 'unknown-ingredient')) return undefined;
  return (spec?.lines ?? []).filter((_, i) => isOpen(i));
}

/** The ways a line can be satisfied: (ingredient, mode) pairs, as in `lineFixers`. */
function members(ev: Evaluation, line: StockLine, mode: StockMode): [Id, StockMode][] {
  const tree = ev.index.tree;
  if (!tree.byId.has(line.ingredientId)) return [];
  const out: [Id, StockMode][] = ev.index.family(line.ingredientId).map((x) => [x, mode]);
  if (mode === 'with-substitutes') {
    for (const listed of line.substitutes ?? []) {
      if (!tree.byId.has(listed.ingredientId)) continue;
      for (const x of ev.index.family(listed.ingredientId)) out.push([x, 'strict']);
    }
    for (const x of ev.index.substitutesOf(line.ingredientId)) out.push([x, 'strict']);
  }
  return out;
}

/**
 * Every ingredient that could take part in satisfying the line, alone or with
 * others: the line's family and substitutes, and the parts of incomplete
 * prepared ingredients among them, recursively.
 *
 * @param ev - The evaluation of the current stock.
 * @param line - A line that is not satisfied in `mode`.
 * @param mode - Whether substitutes may be used.
 * @param out - The set to fill.
 * @param stack - Prepared ingredients being resolved above this line.
 */
export function linePool(
  ev: Evaluation,
  line: StockLine,
  mode: StockMode,
  out: Set<Id>,
  stack: readonly Id[] = [],
): void {
  for (const [x, m] of members(ev, line, mode)) {
    out.add(x);
    const parts = openParts(ev, x, m, stack);
    for (const part of parts ?? []) linePool(ev, part, m, out, [...stack, x]);
  }
}

/**
 * Whether adding the whole set to the stock satisfies the line.
 *
 * @param ev - The evaluation of the current stock.
 * @param line - A line that is not satisfied in `mode`.
 * @param mode - Whether substitutes may be used.
 * @param added - The ingredients added together.
 * @param stack - Prepared ingredients being resolved above this line.
 * @returns True when the line is satisfied with the set added.
 */
export function lineFixedBy(
  ev: Evaluation,
  line: StockLine,
  mode: StockMode,
  added: ReadonlySet<Id>,
  stack: readonly Id[] = [],
): boolean {
  return members(ev, line, mode).some(([x, m]) => {
    if (added.has(x)) return true;
    const parts = openParts(ev, x, m, stack);
    return parts !== undefined && parts.every((p) => lineFixedBy(ev, p, m, added, [...stack, x]));
  });
}
