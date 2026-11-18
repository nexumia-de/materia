// Candidates for swapping one line's ingredient while trying a drink
// (docs/ingredients.md#swap-candidates). `substitutesFor` answers only for
// the same class and role; a swap also needs the same role alone, and a
// line without a role needs the class and the tree neighbours.
import { inheritedValue } from './properties';
import { ancestors, distance, type IngredientTreeOf } from './tree';
import type { Id } from './types';

/** `class`: same class (and same role when there is one); `role`: same role, other class; `near`: siblings and children in the tree. */
export type SwapGroupKind = 'class' | 'role' | 'near';

export interface SwapGroup {
  kind: SwapGroupKind;
  /** Ordered by tree distance, then id. */
  ids: Id[];
}

export interface SwapCandidates {
  /** Non-empty groups in the order the user should see them. */
  groups: SwapGroup[];
  /** Why there are no groups because the id is unknown; absent when merely nothing matches. */
  reason?: string;
}

export interface SwapOptions {
  /** The role of the line's slot when it differs from the ingredient's own (a role set on the line). */
  role?: string;
}

const byDistanceThenId = (a: { id: Id; d: number }, b: { id: Id; d: number }): number =>
  a.d - b.d || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

/**
 * Ingredients that can stand in for `id` in a line, nearest first, in groups.
 *
 * With a role: the same class and role first (the list of `substitutesFor`),
 * then the same role of other classes (categories left out). Without a role:
 * the same class, then the siblings and children in the tree (categories left out). The ingredient itself and its ancestors are
 * never offered, and nothing is guessed: no group means "search all".
 *
 * @param tree - A validated tree.
 * @param id - Ingredient id of the line.
 * @param options - `role` of the line's slot, when the line sets its own.
 * @returns The non-empty groups, or an empty list with a reason for an unknown id.
 */
export function swapCandidates(
  tree: IngredientTreeOf,
  id: Id,
  options: SwapOptions = {},
): SwapCandidates {
  if (!tree.byId.has(id)) return { groups: [], reason: `unknown ingredient ${id}` };
  const cls = inheritedValue(tree, id, 'substitutionClass').value;
  const role = options.role ?? inheritedValue(tree, id, 'role').value;
  const left = new Set([id, ...(ancestors(tree, id) ?? [])]);
  const others = tree.ids
    .filter((other) => !left.has(other))
    .map((other) => ({
      id: other,
      d: distance(tree, id, other) as number,
      cls: inheritedValue(tree, other, 'substitutionClass').value,
      role: inheritedValue(tree, other, 'role').value,
      category: tree.byId.get(other)?.level === 'category',
    }));
  const ordered = (list: typeof others): Id[] => [...list].sort(byDistanceThenId).map((o) => o.id);
  const groups: SwapGroup[] = [];
  const inClass =
    cls === undefined
      ? []
      : others.filter((o) => o.cls === cls && (role === undefined || o.role === role));
  if (inClass.length > 0) groups.push({ kind: 'class', ids: ordered(inClass) });
  const taken = new Set(inClass.map((o) => o.id));
  const rest = others.filter((o) => !taken.has(o.id) && !o.category);
  if (role !== undefined) {
    const sameRole = rest.filter((o) => o.role === role);
    if (sameRole.length > 0) groups.push({ kind: 'role', ids: ordered(sameRole) });
  } else {
    const parent = tree.byId.get(id)?.parentId;
    const near = rest.filter((o) => {
      const other = tree.byId.get(o.id)?.parentId;
      return other === id || (parent !== undefined && other === parent);
    });
    if (near.length > 0) groups.push({ kind: 'near', ids: ordered(near) });
  }
  return { groups };
}
