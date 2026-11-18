// Substitution classes: ingredients with the same resolved class and the
// same resolved role can stand in for each other by default.
import { inheritedValue } from './properties';
import { ancestors, distance, type IngredientTreeOf } from './tree';
import type { Id } from './types';

/**
 * Whether two ingredients can stand in for each other by class.
 *
 * @param tree - A validated tree.
 * @param a - First ingredient id.
 * @param b - Second ingredient id.
 * @returns True if both have a resolved substitution class and it is the same.
 */
export function sameClass(tree: IngredientTreeOf, a: Id, b: Id): boolean {
  const ca = inheritedValue(tree, a, 'substitutionClass').value;
  const cb = inheritedValue(tree, b, 'substitutionClass').value;
  return ca !== undefined && ca === cb;
}

export interface Substitutes {
  /** Ordered by tree distance, then id. */
  ids: Id[];
  /** Why the list is empty because something is unknown; absent when merely nothing matches. */
  reason?: string;
}

/**
 * Ingredients of the same class and role as `id`, nearest first.
 *
 * @param tree - A validated tree.
 * @param id - Ingredient id.
 * @returns Ids with the reason when empty; the ingredient itself and its ancestors are left out and nothing is guessed.
 */
export function substitutesFor(tree: IngredientTreeOf, id: Id): Substitutes {
  if (!tree.byId.has(id)) return { ids: [], reason: `unknown ingredient ${id}` };
  const cls = inheritedValue(tree, id, 'substitutionClass');
  if (cls.value === undefined) return { ids: [], reason: cls.reason };
  const role = inheritedValue(tree, id, 'role');
  if (role.value === undefined) return { ids: [], reason: role.reason };
  const excluded = new Set([id, ...(ancestors(tree, id) ?? [])]);
  const found = tree.ids
    .filter((other) => !excluded.has(other))
    .filter((other) => inheritedValue(tree, other, 'substitutionClass').value === cls.value)
    .filter((other) => inheritedValue(tree, other, 'role').value === role.value)
    .map((other) => ({ other, d: distance(tree, id, other) as number }));
  found.sort((x, y) => x.d - y.d || (x.other < y.other ? -1 : x.other > y.other ? 1 : 0));
  return { ids: found.map((f) => f.other) };
}
