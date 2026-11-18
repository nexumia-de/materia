// One stock, read against an index: the set of ingredients at hand and the
// memo of prepared ingredients. Created per stock change; never stored.
import type { Id } from '../ingredients/index';
import type { LineResult, StockEntry, StockIndex, StockMode } from './types';

export type PreparedAvailability =
  | { ok: true; parts: LineResult[]; substituted: boolean }
  | { ok: false; reason: 'prepared-cycle' | 'unknown-spec' | 'incomplete'; parts: LineResult[] };

export interface Evaluation {
  readonly index: StockIndex;
  /** Ingredients with a record `present: true` that are in the tree. */
  readonly stocked: ReadonlySet<Id>;
  readonly memo: Record<StockMode, Map<Id, PreparedAvailability>>;
}

/**
 * Reads a stock against an index.
 *
 * @param index - The stock index.
 * @param stock - Stock records; for a repeated ingredient the last record counts.
 * @returns The evaluation and the ids of records that are not in the tree.
 */
export function evaluate(
  index: StockIndex,
  stock: readonly StockEntry[],
): { ev: Evaluation; ignored: Id[] } {
  const last = new Map<Id, boolean>();
  for (const entry of stock) last.set(entry.ingredientId, entry.present);
  const stocked = new Set<Id>();
  const ignored: Id[] = [];
  for (const [id, present] of last) {
    if (!index.tree.byId.has(id)) ignored.push(id);
    else if (present) stocked.add(id);
  }
  ignored.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  return {
    ev: { index, stocked, memo: { strict: new Map(), 'with-substitutes': new Map() } },
    ignored,
  };
}
