// Builds and validates the ingredient tree from a flat list, and answers
// questions about it (ancestors, descendants, isA, distance). Pure.
import type { BaseIngredient, Id, TreeError } from './types';

/** The tree of a domain's ingredients (drinks: `IngredientTree`). */
export interface IngredientTreeOf<I extends BaseIngredient = BaseIngredient> {
  /** Ingredients by id. */
  readonly byId: ReadonlyMap<Id, I>;
  /** Child ids by parent id, sorted by id. */
  readonly children: ReadonlyMap<Id, readonly Id[]>;
  /** All ids, sorted. */
  readonly ids: readonly Id[];
}

export type TreeResultOf<I extends BaseIngredient = BaseIngredient> =
  { ok: true; tree: IngredientTreeOf<I> } | { ok: false; errors: TreeError[] };

const byText = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

/** Finds each cycle once, starting at its smallest id, ids closing back on the first. */
function findCycles(byId: Map<Id, BaseIngredient>): TreeError[] {
  const errors: TreeError[] = [];
  const done = new Set<Id>();
  for (const start of [...byId.keys()].sort(byText)) {
    const path: Id[] = [];
    const onPath = new Map<Id, number>();
    let cur: Id | undefined = start;
    while (cur !== undefined && !done.has(cur) && byId.has(cur)) {
      if (onPath.has(cur)) {
        const ring = path.slice(onPath.get(cur));
        const first = ring.reduce((a, b) => (byText(a, b) <= 0 ? a : b));
        const at = ring.indexOf(first);
        const ids = [...ring.slice(at), ...ring.slice(0, at), first];
        errors.push({
          code: 'cycle',
          ids,
          message: `cycle in the ingredient tree: ${ids.join(' -> ')}`,
        });
        break;
      }
      onPath.set(cur, path.length);
      path.push(cur);
      cur = byId.get(cur)?.parentId;
    }
    for (const id of path) done.add(id);
  }
  return errors;
}

/**
 * Validates the list and builds the ingredient tree.
 *
 * @param list - Ingredients with ids, `parentId` links and levels; ABV in percent, sugar in g per 100 ml, acid in percent.
 * @returns The tree, or every error found: duplicate ids, missing parents, cycles, a category below another node or any node below a product.
 */
export function buildTree<I extends BaseIngredient>(list: readonly I[]): TreeResultOf<I> {
  const errors: TreeError[] = [];
  const byId = new Map<Id, I>();
  const duplicates = new Set<Id>();
  for (const item of list) {
    if (byId.has(item.id)) duplicates.add(item.id);
    else byId.set(item.id, item);
  }
  for (const id of [...duplicates].sort(byText)) {
    errors.push({ code: 'duplicate-id', ids: [id], message: `duplicate ingredient id: ${id}` });
  }
  for (const id of [...byId.keys()].sort(byText)) {
    const item = byId.get(id) as I;
    if (item.parentId === undefined) continue;
    const parent = byId.get(item.parentId);
    if (!parent) {
      errors.push({
        code: 'missing-parent',
        ids: [id, item.parentId],
        message: `${id} has parent ${item.parentId}, which does not exist`,
      });
    } else if (item.level === 'category' || parent.level === 'product') {
      errors.push({
        code: 'level-order',
        ids: [id, item.parentId],
        message: `${id} (${item.level}) cannot be below ${item.parentId} (${parent.level}): a category is a root and a product has no children`,
      });
    }
  }
  errors.push(...findCycles(byId));
  if (errors.length > 0) return { ok: false, errors };

  const kids = new Map<Id, Id[]>();
  for (const item of byId.values()) {
    if (item.parentId !== undefined) {
      kids.set(item.parentId, [...(kids.get(item.parentId) ?? []), item.id]);
    }
  }
  for (const list of kids.values()) list.sort(byText);
  return { ok: true, tree: { byId, children: kids, ids: [...byId.keys()].sort(byText) } };
}

/**
 * An ingredient by id.
 *
 * @param tree - A validated tree.
 * @param id - Ingredient id.
 * @returns The ingredient record, or undefined for an unknown id.
 */
export function getIngredient<I extends BaseIngredient>(
  tree: IngredientTreeOf<I>,
  id: Id,
): I | undefined {
  return tree.byId.get(id);
}

/**
 * The ancestors of an ingredient.
 *
 * @param tree - A validated tree.
 * @param id - Ingredient id.
 * @returns Ancestor ids, nearest first; undefined for an unknown id.
 */
export function ancestors(tree: IngredientTreeOf, id: Id): Id[] | undefined {
  if (!tree.byId.has(id)) return undefined;
  const out: Id[] = [];
  let cur = tree.byId.get(id)?.parentId;
  while (cur !== undefined) {
    out.push(cur);
    cur = tree.byId.get(cur)?.parentId;
  }
  return out;
}

/**
 * The descendants of an ingredient.
 *
 * @param tree - A validated tree.
 * @param id - Ingredient id.
 * @returns Descendant ids, breadth first, siblings by id; undefined for an unknown id.
 */
export function descendants(tree: IngredientTreeOf, id: Id): Id[] | undefined {
  if (!tree.byId.has(id)) return undefined;
  const out: Id[] = [];
  let level = [...(tree.children.get(id) ?? [])];
  while (level.length > 0) {
    out.push(...level);
    level = level.flatMap((c) => tree.children.get(c) ?? []);
  }
  return out;
}

/**
 * Whether one ingredient is the other or below it.
 *
 * @param tree - A validated tree.
 * @param child - Id of the ingredient asked about.
 * @param ancestor - Id of the candidate ancestor.
 * @returns True if `child` is `ancestor` or below it; false for unknown ids.
 */
export function isA(tree: IngredientTreeOf, child: Id, ancestor: Id): boolean {
  if (!tree.byId.has(ancestor)) return false;
  return child === ancestor
    ? tree.byId.has(child)
    : (ancestors(tree, child) ?? []).includes(ancestor);
}

/**
 * The distance of two ingredients in the tree.
 *
 * @param tree - A validated tree.
 * @param a - First ingredient id.
 * @param b - Second ingredient id.
 * @returns Number of steps through the nearest common ancestor (two roots are 2 apart); undefined for an unknown id.
 */
export function distance(tree: IngredientTreeOf, a: Id, b: Id): number | undefined {
  const pa = ancestors(tree, a);
  const pb = ancestors(tree, b);
  if (!pa || !pb) return undefined;
  const chainA = [a, ...pa];
  const chainB = [b, ...pb];
  const common = chainA.find((x) => chainB.includes(x));
  if (common === undefined) return chainA.length + chainB.length;
  return chainA.indexOf(common) + chainB.indexOf(common);
}
