// The part of the stock computation that depends only on the tree and the
// specs: families (an ingredient and its descendants) and class
// substitutes, computed on first use and kept. Derived, never stored.
import { descendants, substitutesFor, type Id } from '../ingredients/index';
import type { IngredientTreeOf } from '../ingredients/tree';
import type { StockIndex, StockSpec } from './types';

const byText = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

/**
 * Builds the stock index of an ingredient tree and a list of specs.
 *
 * @param tree - A validated tree.
 * @param specs - Specs (also the specs of prepared ingredients); any order, ids unique.
 * @returns The index to pass to `makeableSpecs`, `missingOne` and `unlockRanking`; build it again when tree or specs change, not when the stock changes.
 */
export function buildStockIndex(tree: IngredientTreeOf, specs: readonly StockSpec[]): StockIndex {
  const sorted = [...specs].sort((a, b) => byText(a.id, b.id));
  const specsById = new Map(sorted.map((s) => [s.id, s]));
  const families = new Map<Id, readonly Id[]>();
  const substitutes = new Map<Id, readonly Id[]>();
  return {
    tree,
    specs: sorted,
    specsById,
    family(id) {
      let found = families.get(id);
      if (!found) {
        found = [id, ...(descendants(tree, id) ?? [])];
        families.set(id, found);
      }
      return found;
    },
    substitutesOf(id) {
      let found = substitutes.get(id);
      if (!found) {
        found = substitutesFor(tree, id).ids;
        substitutes.set(id, found);
      }
      return found;
    },
    levelOf: (id) => tree.byId.get(id)?.level,
  };
}
