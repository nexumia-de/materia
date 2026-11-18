// The general part of prepared ingredients: walking a prepared ingredient's
// spec, its nested prepared ingredients, cycles and unknown ids. What a
// prepared ingredient's value is (ABV, sugar and acid for drinks, a shelf
// life) is the caller's fold; the resolver only walks and reports errors.
import type { IngredientTreeOf } from './tree';
import type { Id } from './types';

/** A line of a prepared ingredient's spec, already in ml (and g of solid sugar). */
export interface PreparedLine {
  ingredientId: Id;
  ml: number;
  sugarG?: number;
}

export interface PreparedSpec {
  lines: readonly PreparedLine[];
  /** Water added on top of the lines, in ml. */
  addedWaterMl?: number;
  /**
   * What one run yields, in ml. When given it is the volume of the result
   * (solid sugar dissolves into less than the sum of its parts); the totals
   * of ethanol, sugar and acid are conserved. Absent: volumes add.
   */
  yieldMl?: number;
}

export type PreparedErrorCode =
  'prepared-cycle' | 'unknown-ingredient' | 'unknown-spec' | 'not-prepared';

export interface PreparedError {
  code: PreparedErrorCode;
  ids: Id[];
  message: string;
}

/** Specs by spec id (`prepared.specId` of an ingredient). */
export type SpecLookup = ReadonlyMap<Id, PreparedSpec>;

/** What a caller computes while the resolver walks a prepared ingredient. */
export interface PreparedFold<T> {
  /** The value of a line whose ingredient is known and not prepared. */
  raw(id: Id): T | undefined;
  /**
   * The value of a prepared ingredient from its spec (undefined when the
   * spec is unknown) and the values of its lines in line order (undefined
   * for a line that failed).
   */
  prepared(
    id: Id,
    spec: PreparedSpec | undefined,
    parts: readonly (T | undefined)[],
  ): T | undefined;
}

/** The fold's value (undefined when the ingredient itself failed) and every error met on the way. */
export interface PreparedResolution<T> {
  value: T | undefined;
  errors: PreparedError[];
}

function walk<T>(
  tree: IngredientTreeOf,
  specs: SpecLookup,
  id: Id,
  stack: readonly Id[],
  fold: PreparedFold<T>,
): PreparedResolution<T> {
  const item = tree.byId.get(id);
  if (!item) {
    return {
      value: undefined,
      errors: [
        { code: 'unknown-ingredient', ids: [...stack, id], message: `unknown ingredient ${id}` },
      ],
    };
  }
  if (!item.prepared) {
    return {
      value: undefined,
      errors: [{ code: 'not-prepared', ids: [id], message: `${id} is not a prepared ingredient` }],
    };
  }
  if (stack.includes(id)) {
    const ids = [...stack.slice(stack.indexOf(id)), id];
    return {
      value: undefined,
      errors: [
        { code: 'prepared-cycle', ids, message: `prepared ingredient cycle: ${ids.join(' -> ')}` },
      ],
    };
  }
  const spec = specs.get(item.prepared.specId);
  if (!spec) {
    const ids = [id, item.prepared.specId];
    return {
      value: fold.prepared(id, undefined, []),
      errors: [
        {
          code: 'unknown-spec',
          ids,
          message: `${id} refers to spec ${item.prepared.specId}, which is not known`,
        },
      ],
    };
  }

  const errors: PreparedError[] = [];
  const parts: (T | undefined)[] = [];
  for (const line of spec.lines) {
    const target = tree.byId.get(line.ingredientId);
    if (!target) {
      errors.push({
        code: 'unknown-ingredient',
        ids: [id, line.ingredientId],
        message: `${id}: unknown ingredient ${line.ingredientId}`,
      });
      parts.push(undefined);
    } else if (target.prepared) {
      const nested = walk(tree, specs, line.ingredientId, [...stack, id], fold);
      errors.push(...nested.errors);
      parts.push(nested.value);
    } else parts.push(fold.raw(line.ingredientId));
  }
  return { value: fold.prepared(id, spec, parts), errors };
}

/**
 * Walks a prepared ingredient: its spec, nested prepared ingredients
 * (recursively), cycles and unknown ids, and folds a value over it.
 * Errors are deduplicated by message, first occurrence kept.
 */
export function resolvePrepared<T>(
  tree: IngredientTreeOf,
  specs: SpecLookup,
  id: Id,
  fold: PreparedFold<T>,
): PreparedResolution<T> {
  const r = walk(tree, specs, id, [], fold);
  const seen = new Set<string>();
  return {
    value: r.value,
    errors: r.errors.filter((e) => !seen.has(e.message) && seen.add(e.message)),
  };
}
