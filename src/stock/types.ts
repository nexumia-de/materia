// Types of the stock module: what the stock allows (docs/makeable.md).
import type { Id, Level } from '../ingredients/index';
import type { IngredientTreeOf } from '../ingredients/tree';

/** Whether substitutes may be used. `strict`: the exact ingredient, a descendant or a prepared ingredient. */
export type StockMode = 'strict' | 'with-substitutes';

export type SpecStatus = 'draft' | 'on-menu' | 'retired';

/** A record of the stock entity (docs/data-model.md#stock); other fields are not read. */
export interface StockEntry {
  ingredientId: Id;
  present: boolean;
}

/** The part of a spec line the stock module reads. */
export interface StockLine {
  ingredientId: Id;
  /** `true`: the drink works without the line; it never blocks. */
  optional?: boolean;
  /** Ingredients the spec's author names as stand-ins for this line. */
  substitutes?: readonly { ingredientId: Id }[];
}

/** The part of a spec the stock module reads. Absent `status` counts as `on-menu`. */
export interface StockSpec {
  id: Id;
  status?: SpecStatus;
  templateId?: Id;
  lines: readonly StockLine[];
}

/** How a line is satisfied. */
export type SatisfiedBy =
  'exact' | 'hierarchy' | 'prepared' | 'listed-substitute' | 'class-substitute';

export type UnsatisfiedReason = 'not-in-stock' | 'unknown-ingredient';

export interface LineResult {
  /** The ingredient the line asks for. */
  ingredientId: Id;
  optional: boolean;
  satisfied: boolean;
  /** Rule that satisfied the line; absent when it is not satisfied. */
  rule?: SatisfiedBy;
  /** The stocked ingredient, or the prepared ingredient made from its parts, that satisfies the line. */
  by?: Id;
  /** For a substitute: the listed ingredient (listed-substitute) or the asked ingredient it replaces. */
  via?: Id;
  /** True when a substitute is used on this line or inside a prepared ingredient it needs. */
  substituted: boolean;
  /** Lines of the prepared ingredient's spec, when `rule` is `prepared` or the line asks for an incomplete one. */
  parts?: LineResult[];
  reason?: UnsatisfiedReason;
  /** Ingredients to acquire for this line, sorted; for a prepared ingredient its missing raw parts. */
  missing: Id[];
}

export type MakeableStatus =
  'makeable' | 'makeable-with-substitution' | 'missing' | 'unknown-ingredient';

export interface SpecResult {
  specId: Id;
  status: MakeableStatus;
  /** Mode used for this result; substitutes are only applied in `with-substitutes`. */
  mode: StockMode;
  lines: LineResult[];
  /** Ingredients to acquire for the required lines, distinct, sorted. */
  missing: Id[];
  /** Ingredients of required lines that are not in the tree, sorted; they block and cannot be bought. */
  unknown: Id[];
}

export interface StockOptions {
  /** Default `strict`. */
  mode?: StockMode;
  /** Specs with these statuses are left out of results. Default `['retired']`. */
  excludeStatuses?: readonly SpecStatus[];
}

export interface MakeableReport {
  mode: StockMode;
  /** One result per spec, ordered by spec id. */
  specs: SpecResult[];
  /** Stock records whose ingredient is not in the tree; they are ignored. */
  ignoredStock: Id[];
}

export interface MissingOne {
  specId: Id;
  /** The one ingredient to acquire. */
  missing: Id;
  /** Listed substitutes of the line, then class substitutes, nearest first; may be empty. */
  substitutes: Id[];
}

/** Everything derived from the tree and the specs, independent of the stock; built once, reused on every stock change. */
export interface StockIndex {
  readonly tree: IngredientTreeOf;
  /** Specs ordered by id. */
  readonly specs: readonly StockSpec[];
  readonly specsById: ReadonlyMap<Id, StockSpec>;
  /** The ingredient and its descendants, nearest first. */
  family(id: Id): readonly Id[];
  /** Class and role substitutes of an ingredient, nearest first. */
  substitutesOf(id: Id): readonly Id[];
  /** Level of an ingredient. */
  levelOf(id: Id): Level | undefined;
}
