// Resolves inherited properties from the nearest ancestor that defines
// them and reports which ancestor supplied the value (docs/data-model.md,
// "Inheritance"). Missing values come back as undefined plus a reason.
// Which properties are inherited and which are computed for a prepared
// ingredient is the domain's list (drinks: drink-ingredients/properties.ts).
import type { IngredientTreeOf } from './tree';
import type { BaseIngredient, Cost, Found, Id, Missing, Resolved } from './types';

/**
 * Reads a property from the ingredient or its nearest ancestor that has it.
 * A property in `computedWhenPrepared` stops at a prepared ingredient: its
 * value comes from the spec, never from an ancestor.
 */
export function inheritedValue<I extends BaseIngredient, P extends keyof I & string>(
  tree: IngredientTreeOf<I>,
  id: Id,
  property: P,
  computedWhenPrepared: readonly string[] = [],
): Resolved<NonNullable<I[P]>> {
  let cur: I | undefined = tree.byId.get(id);
  if (!cur) return { value: undefined, reason: `unknown ingredient ${id}` };
  while (cur) {
    const own = cur[property];
    if (own !== undefined) return { value: own as NonNullable<I[P]>, from: cur.id };
    if (cur.prepared && computedWhenPrepared.includes(property)) {
      return {
        value: undefined,
        reason: `${cur.id} is a prepared ingredient: its ${property} is computed from its spec`,
      };
    }
    cur = cur.parentId === undefined ? undefined : tree.byId.get(cur.parentId);
  }
  return { value: undefined, reason: `no ancestor of ${id} defines ${property}` };
}

/** Every property of a domain's inherited list, resolved with its source. */
export type ResolvedOf<I extends BaseIngredient, P extends keyof I & string> = {
  [K in P]: Resolved<NonNullable<I[K]>>;
};

/** `inheritedValue` for each property of a domain's inherited list. */
export function resolveAllOf<I extends BaseIngredient, P extends keyof I & string>(
  tree: IngredientTreeOf<I>,
  id: Id,
  inherited: readonly P[],
  computedWhenPrepared: readonly string[] = [],
): ResolvedOf<I, P> {
  const out: Record<string, Found<unknown> | Missing> = {};
  for (const p of inherited) out[p] = inheritedValue(tree, id, p, computedWhenPrepared);
  return out as ResolvedOf<I, P>;
}

/**
 * The price record of the ingredient itself: cost is never inherited.
 *
 * @param tree - A validated tree.
 * @param id - Ingredient id.
 * @returns The cost (price in the record's currency for a quantity) or no value and the reason.
 */
export function resolveCost(tree: IngredientTreeOf, id: Id): Resolved<Cost> {
  const item = tree.byId.get(id);
  if (!item) return { value: undefined, reason: `unknown ingredient ${id}` };
  if (item.cost) return { value: item.cost, from: id };
  return { value: undefined, reason: `${id} has no cost; cost is not inherited` };
}
