// Variants of the template a spec matches: for a spec that follows a root
// template, the variants of that template for another class (drinks: the
// alcohol class), as starting points. Which lines would be replaced, which
// carried over and which slots are left to fill; nothing is said about
// taste or balance (docs/templates.md#variants-by-alcohol-class).
import type { IngredientTreeOf } from '../ingredients/tree';
import type { BaseIngredient, Id } from '../ingredients/types';
import { matchTemplates } from './match';
import { lineRole } from './slots';
import type { LineMeasure, MatchDomain, MatchSpec, Template } from './types';

/** A slot of the variant that no carried-over line fills: the user chooses an ingredient for it. */
export interface OpenSlot<R extends string = string> {
  slotId: Id;
  role: R;
  /** The template's own words about what goes there. */
  note?: string;
}

export type VariantsReason = 'no-template' | 'is-variant' | 'no-variant';

/** What variants need to know of a domain beside matching. */
export interface VariantDomain<R extends string, T extends Template<R>> extends MatchDomain<R, T> {
  /** The variant classes offered (drinks: `none`, `low`). */
  classes: readonly string[];
  /** The role whose lines a variant replaces (drinks: `base`). */
  replacedRole: R;
}

export interface VariantMatch<R extends string, T> {
  template: T;
  /** Indexes of the lines of the replaced role. */
  replacedLines: number[];
  /** Indexes of the other lines: carried over unchanged. */
  keptLines: number[];
  /** Slots left to fill, in the variant's order. */
  openSlots: OpenSlot<R>[];
}

export interface VariantsFound<R extends string, T> {
  /** The template the spec follows (explicit or suggested), when there is one. */
  templateId?: Id;
  variants: VariantMatch<R, T>[];
  /** Why `variants` is empty. */
  reason?: VariantsReason;
}

/**
 * The variants of the template a spec follows, matched without a variant
 * class; empty with a reason when the spec has no template, follows a
 * variant already, or its template has no variant.
 */
export function findVariants<R extends string, T extends Template<R>>(
  tree: IngredientTreeOf<BaseIngredient & { role?: R }>,
  templates: readonly T[],
  spec: MatchSpec<R>,
  measure: LineMeasure<R>,
  domain: VariantDomain<R, T>,
): VariantsFound<R, T> {
  const chosen = matchTemplates(tree, templates, spec, measure, domain, undefined).chosen;
  if (!chosen || !chosen.known) return { variants: [], reason: 'no-template' };
  const root = templates.find((t) => t.id === chosen.templateId);
  if (!root) return { variants: [], reason: 'no-template' };
  if (domain.variantClass(root) !== undefined) {
    return { templateId: root.id, variants: [], reason: 'is-variant' };
  }
  const roles = spec.lines.map((line) => lineRole(tree, line));
  const replaced: number[] = [];
  const kept: number[] = [];
  roles.forEach((r, i) =>
    ('role' in r && r.role === domain.replacedRole ? replaced : kept).push(i),
  );
  const keptRoles = new Set(
    kept.flatMap((i) => (roles[i] && 'role' in roles[i] ? [roles[i].role] : [])),
  );
  const variants = templates.filter((t) => {
    const c = domain.variantClass(t);
    return t.parentId === root.id && c !== undefined && domain.classes.includes(c);
  });
  if (variants.length === 0) return { templateId: root.id, variants: [], reason: 'no-variant' };
  return {
    templateId: root.id,
    variants: variants.map((v) => ({
      template: v,
      replacedLines: replaced,
      keptLines: kept,
      openSlots: v.slots
        .filter((s) => s.role === domain.replacedRole || !keptRoles.has(s.role))
        .filter((s) => s.optional !== true || s.role === domain.replacedRole)
        .map((s) => ({ slotId: s.id, role: s.role, ...(s.note && { note: s.note }) })),
    })),
  };
}
