// The shelf life that applies to a prepared ingredient: the user's own value on
// it and on the prepared ingredients it is made from, the shortest wins and its
// ingredient is named. Raw parts carry no shelf life in the data, so they say
// nothing here; a part without a value never makes a number up.
import type { IngredientTreeOf } from '../ingredients/tree';
import { inheritedValue } from '../ingredients/properties';
import { resolvePrepared, type PreparedFold, type SpecLookup } from '../ingredients/prepared';
import type { Id } from '../ingredients/types';

export type LimitingShelfLife = { known: true; days: number; limitingId: Id } | { known: false };

type Candidate = { days: number; id: Id };

function own(tree: IngredientTreeOf, id: Id): Candidate[] {
  const v = inheritedValue(tree, id, 'shelfLifeDays').value;
  return v === undefined ? [] : [{ days: v, id }];
}

/** Own value first, then the prepared lines in order; raw lines and failed lines say nothing. */
function shelfFold(tree: IngredientTreeOf): PreparedFold<Candidate[]> {
  return {
    raw: () => [],
    prepared: (id, _spec, parts) => [...own(tree, id), ...parts.flatMap((p) => p ?? [])],
  };
}

/**
 * The shortest shelf life among a prepared ingredient and the prepared ingredients inside it.
 *
 * @param tree - A validated tree.
 * @param specs - Specs of prepared ingredients by spec id.
 * @param id - The prepared ingredient.
 * @returns Days and the ingredient that sets them (the outer one on a tie, then the first line), or `known: false` when none has a value.
 */
export function limitingShelfLife(
  tree: IngredientTreeOf,
  specs: SpecLookup,
  id: Id,
): LimitingShelfLife {
  const found = resolvePrepared(tree, specs, id, shelfFold(tree)).value ?? own(tree, id);
  let best: Candidate | undefined;
  for (const c of found) if (!best || c.days < best.days) best = c;
  return best ? { known: true, days: best.days, limitingId: best.id } : { known: false };
}
