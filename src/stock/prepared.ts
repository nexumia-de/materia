// A prepared ingredient counts as available when all required lines of its
// own spec are satisfied, recursively; a cycle makes it unavailable.
import type { Evaluation, PreparedAvailability } from './evaluation';
import { satisfyLine } from './satisfies';
import type { Id } from '../ingredients/index';
import type { StockMode } from './types';

/**
 * Whether the prepared ingredient `id` can be made from the stock.
 *
 * @param ev - The evaluation of a stock.
 * @param id - A prepared ingredient (it has `prepared`).
 * @param mode - Whether the parts may use substitutes.
 * @param stack - Prepared ingredients being resolved above this one, for cycle detection.
 * @returns Available with the satisfied parts, or why not with the parts as far as known.
 */
export function preparedAvailability(
  ev: Evaluation,
  id: Id,
  mode: StockMode,
  stack: readonly Id[],
): PreparedAvailability {
  if (stack.includes(id)) return { ok: false, reason: 'prepared-cycle', parts: [] };
  const memo = ev.memo[mode];
  const known = memo.get(id);
  if (known) return known;
  const specId = ev.index.tree.byId.get(id)?.prepared?.specId;
  const spec = specId === undefined ? undefined : ev.index.specsById.get(specId);
  let result: PreparedAvailability;
  if (!spec) {
    result = { ok: false, reason: 'unknown-spec', parts: [] };
  } else {
    const parts = spec.lines.map((line) => satisfyLine(ev, line, mode, [...stack, id]));
    const open = parts.some((p) => !p.satisfied && !p.optional);
    result = open
      ? { ok: false, reason: 'incomplete', parts }
      : { ok: true, parts, substituted: parts.some((p) => !p.optional && p.substituted) };
  }
  memo.set(id, result);
  return result;
}
