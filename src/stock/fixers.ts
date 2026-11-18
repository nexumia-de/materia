// Which single ingredient, added to the stock, would satisfy a line that is
// not satisfied now. It mirrors the rules of satisfies.ts exactly (the
// unlock tests compare it with adding each ingredient and recomputing).
import type { Id } from '../ingredients/index';
import type { Evaluation } from './evaluation';
import { preparedAvailability } from './prepared';
import type { StockLine, StockMode } from './types';

export function intersect(sets: readonly Set<Id>[]): Set<Id> {
  const [first, ...rest] = [...sets].sort((a, b) => a.size - b.size);
  const out = new Set<Id>();
  for (const id of first ?? []) if (rest.every((s) => s.has(id))) out.add(id);
  return out;
}

/** The ingredient itself, and for a prepared one the ingredients that complete all its missing parts together. */
function coverFixers(ev: Evaluation, id: Id, mode: StockMode, stack: readonly Id[]): Set<Id> {
  const out = new Set<Id>([id]);
  if (ev.index.tree.byId.get(id)?.prepared === undefined || stack.includes(id)) return out;
  const made = preparedAvailability(ev, id, mode, stack);
  if (made.ok || made.reason !== 'incomplete') return out;
  const specId = ev.index.tree.byId.get(id)?.prepared?.specId;
  const spec = specId === undefined ? undefined : ev.index.specsById.get(specId);
  const isOpen = (i: number) => {
    const part = made.parts[i];
    return part !== undefined && !part.satisfied && !part.optional;
  };
  if (made.parts.some((p, i) => isOpen(i) && p.reason === 'unknown-ingredient')) return out;
  const lines = (spec?.lines ?? []).filter((_, i) => isOpen(i));
  const together = intersect(lines.map((l) => lineFixers(ev, l, mode, [...stack, id])));
  for (const x of together) out.add(x);
  return out;
}

/**
 * The single ingredients whose addition to the stock satisfies the line.
 *
 * @param ev - The evaluation of the current stock.
 * @param line - A line that is not satisfied in `mode`.
 * @param mode - Whether substitutes may be used.
 * @param stack - Prepared ingredients being resolved above this line.
 * @returns The set of ingredient ids; empty when no single ingredient helps.
 */
export function lineFixers(
  ev: Evaluation,
  line: StockLine,
  mode: StockMode,
  stack: readonly Id[] = [],
): Set<Id> {
  const out = new Set<Id>();
  if (!ev.index.tree.byId.has(line.ingredientId)) return out;
  const add = (ids: Iterable<Id>) => {
    for (const x of ids) out.add(x);
  };
  for (const x of ev.index.family(line.ingredientId)) add(coverFixers(ev, x, mode, stack));
  if (mode === 'with-substitutes') {
    for (const listed of line.substitutes ?? []) {
      if (!ev.index.tree.byId.has(listed.ingredientId)) continue;
      for (const x of ev.index.family(listed.ingredientId))
        add(coverFixers(ev, x, 'strict', stack));
    }
    for (const x of ev.index.substitutesOf(line.ingredientId))
      add(coverFixers(ev, x, 'strict', stack));
  }
  return out;
}
