// Does the stock satisfy one spec line, and by which rule (docs/makeable.md#rules).
import type { Id } from '../ingredients/index';
import type { Evaluation } from './evaluation';
import { preparedAvailability } from './prepared';
import type { LineResult, StockLine, StockMode } from './types';

const sortedUnique = (ids: readonly Id[]): Id[] =>
  [...new Set(ids)].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));

const isPrepared = (ev: Evaluation, id: Id): boolean =>
  ev.index.tree.byId.get(id)?.prepared !== undefined;

/** First ingredient of the list that is stocked, or a prepared ingredient made without substitutes. */
function strictHolder(
  ev: Evaluation,
  ids: readonly Id[],
  stack: readonly Id[],
): { id: Id; parts?: LineResult[] } | undefined {
  const stocked = ids.find((x) => ev.stocked.has(x));
  if (stocked !== undefined) return { id: stocked };
  for (const x of ids) {
    if (!isPrepared(ev, x)) continue;
    const made = preparedAvailability(ev, x, 'strict', stack);
    if (made.ok) return { id: x, parts: made.parts };
  }
  return undefined;
}

/**
 * Whether the stock satisfies a spec line.
 *
 * Order of rules: exact, hierarchy (a stocked descendant), prepared (the
 * ingredient or a descendant made from stocked parts); only in
 * `with-substitutes` then a prepared ingredient whose parts need
 * substitutes, the line's listed substitutes, class substitutes.
 *
 * @param ev - The evaluation of a stock.
 * @param line - The line.
 * @param mode - Whether substitutes may be used.
 * @param stack - Prepared ingredients being resolved above this line.
 * @returns The line result with rule, satisfier and, if not satisfied, the ingredients to acquire.
 */
export function satisfyLine(
  ev: Evaluation,
  line: StockLine,
  mode: StockMode,
  stack: readonly Id[] = [],
): LineResult {
  const id = line.ingredientId;
  const base = { ingredientId: id, optional: line.optional === true };
  if (!ev.index.tree.byId.has(id)) {
    return {
      ...base,
      satisfied: false,
      substituted: false,
      reason: 'unknown-ingredient',
      missing: [],
    };
  }
  const done = (rule: LineResult['rule'], by: Id, extra: Partial<LineResult> = {}): LineResult => ({
    ...base,
    satisfied: true,
    rule,
    by,
    substituted: false,
    missing: [],
    ...extra,
  });

  const family = ev.index.family(id);
  const stocked = family.find((x) => ev.stocked.has(x));
  if (stocked !== undefined) return done(stocked === id ? 'exact' : 'hierarchy', stocked);
  const strict = strictHolder(ev, family, stack);
  if (strict) return done('prepared', strict.id, { parts: strict.parts });

  if (mode === 'with-substitutes') {
    for (const x of family) {
      if (!isPrepared(ev, x)) continue;
      const made = preparedAvailability(ev, x, mode, stack);
      if (made.ok) return done('prepared', x, { parts: made.parts, substituted: true });
    }
    for (const listed of line.substitutes ?? []) {
      if (!ev.index.tree.byId.has(listed.ingredientId)) continue;
      const held = strictHolder(ev, ev.index.family(listed.ingredientId), stack);
      if (held) {
        return done('listed-substitute', held.id, {
          via: listed.ingredientId,
          substituted: true,
          parts: held.parts,
        });
      }
    }
    const held = strictHolder(ev, ev.index.substitutesOf(id), stack);
    if (held) {
      return done('class-substitute', held.id, { via: id, substituted: true, parts: held.parts });
    }
  }
  if (isPrepared(ev, id)) {
    const made = preparedAvailability(ev, id, mode, stack);
    if (!made.ok) {
      const blocked =
        made.reason !== 'incomplete' ||
        made.parts.some((p) => !p.satisfied && !p.optional && p.missing.length === 0);
      const missing = blocked
        ? [id]
        : sortedUnique(made.parts.filter((p) => !p.optional).flatMap((p) => p.missing));
      return {
        ...base,
        satisfied: false,
        substituted: false,
        reason: 'not-in-stock',
        parts: made.parts,
        missing,
      };
    }
  }
  return { ...base, satisfied: false, substituted: false, reason: 'not-in-stock', missing: [id] };
}
