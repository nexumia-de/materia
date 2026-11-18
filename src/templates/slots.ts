// Assigns spec lines to the slots of one template by role and reports the
// lines that fit no slot and the slots that stay empty. No ratios here; how
// a line is measured is the caller's function (by volume: volume.ts).
import { inheritedValue } from '../ingredients/properties';
import type { IngredientTreeOf } from '../ingredients/tree';
import type { BaseIngredient } from '../ingredients/types';
import type {
  LineMeasure,
  MatchLine,
  SlotAssignment,
  SlotFill,
  Template,
  UnassignedReason,
} from './types';

/** A tree whose ingredients carry roles of type `R`. */
export type RoledTree<R extends string> = IngredientTreeOf<BaseIngredient & { role?: R }>;

/**
 * The role a line has: its own, else the ingredient's resolved role.
 *
 * @param tree - A validated tree.
 * @param line - A spec line.
 * @returns The role, or why there is none (unknown ingredient, no role).
 */
export function lineRole<R extends string>(
  tree: RoledTree<R>,
  line: MatchLine<R>,
): { role: R } | { reason: UnassignedReason } {
  if (line.role) return { role: line.role };
  if (!tree.byId.has(line.ingredientId)) return { reason: 'unknown-ingredient' };
  const r = inheritedValue(tree, line.ingredientId, 'role');
  return r.value === undefined ? { reason: 'unknown-role' } : { role: r.value };
}

/**
 * Assigns spec lines to the slots of a template by role and sums each
 * slot's lines with the caller's measure.
 */
export function fillSlots<R extends string>(
  tree: RoledTree<R>,
  template: Template<R>,
  lines: readonly MatchLine<R>[],
  measure: LineMeasure<R>,
): SlotAssignment<R> {
  const fills: SlotFill<R>[] = template.slots.map((s) => ({
    slotId: s.id,
    role: s.role,
    optional: s.optional === true,
    lineIndexes: [],
  }));
  const unassigned: SlotAssignment<R>['unassigned'] = [];
  lines.forEach((line, index) => {
    const found = lineRole(tree, line);
    if ('reason' in found) {
      unassigned.push({ index, ingredientId: line.ingredientId, reason: found.reason });
      return;
    }
    const same = fills.filter((f) => f.role === found.role);
    const target = same.find((f) => f.lineIndexes.length === 0) ?? same[0];
    if (!target) {
      unassigned.push({ index, ingredientId: line.ingredientId, reason: 'no-slot-for-role' });
      return;
    }
    target.lineIndexes.push(index);
  });
  for (const f of fills) {
    let ml = 0;
    for (const i of f.lineIndexes) {
      const v = measure(lines[i] as MatchLine<R>);
      if ('reason' in v) {
        f.unmeasured = v.reason;
        ml = Number.NaN;
        break;
      }
      ml += v.value;
    }
    if (f.lineIndexes.length > 0 && f.unmeasured === undefined) f.ml = ml;
  }
  return {
    fills,
    unassigned,
    emptyRequired: fills
      .filter((f) => !f.optional && f.lineIndexes.length === 0)
      .map((f) => f.slotId),
    emptyOptional: fills
      .filter((f) => f.optional && f.lineIndexes.length === 0)
      .map((f) => f.slotId),
  };
}
