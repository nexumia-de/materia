// General types of the templates module (docs/templates.md). Results are
// numbers, statuses and reasons; nothing in them judges the dish or drink.
// Roles are the domain's role ids (`R`); the drink shapes with the drink
// `Role` union, alcohol class and usual ranges are in
// drink-templates/types.ts.
import type { Id } from '../ingredients/types';

export type TemplateEvidence = 'verified' | 'secondary' | 'derived' | 'assumption';

export interface Range {
  min: number;
  max: number;
}

export interface TemplateSlot<R extends string = string> {
  id: Id;
  role: R;
  minParts: number;
  maxParts: number;
  optional?: boolean;
  note?: string;
}

/** The general fields of a Template of the data model (schemas/template.schema.json). */
export interface Template<R extends string = string> {
  id: Id;
  name: string;
  parentId?: Id;
  slots: TemplateSlot<R>[];
  slotEvidence?: TemplateEvidence;
  method: Id;
  source?: { name: string; licence: string; url?: string; note?: string };
  notes?: string;
}

/** A spec line as matching reads it: a subset of the Spec line of the data model. */
export interface MatchLine<R extends string = string> {
  ingredientId: Id;
  amount: number;
  /** Upper end of a range line; the middle of the range is used. */
  amountMax?: number;
  /** Unit id from units.json. */
  unit: string;
  /** Role in this drink; absent means the ingredient's resolved role. */
  role?: R;
  /** Volume in ml of a `top` line; without it the line has a role but no ratio. */
  topMl?: number;
}

export interface MatchSpec<R extends string = string> {
  /** An explicit template id is never overridden. */
  templateId?: Id;
  lines: readonly MatchLine<R>[];
}

/**
 * How a line is measured for slot ratios: a number in the domain's measure
 * (today ml), or why it has none. Slot sums are in that measure.
 */
export type LineMeasure<R extends string = string> = (
  line: MatchLine<R>,
) => { value: number } | { reason: UnmeasuredReason };

/** What matching needs to know of a domain. */
export interface MatchDomain<R extends string, T extends Template<R>> {
  /** The role of the reference slot that ratios are counted against (drinks: `base`). */
  referenceRole: R;
  /** The class a variant template is for; undefined for a root template (drinks: the alcohol class). */
  variantClass(template: T): string | undefined;
}

export type UnassignedReason = 'unknown-ingredient' | 'unknown-role' | 'no-slot-for-role';
export type UnmeasuredReason =
  'mass' | 'top-without-volume' | 'counted-without-volume' | 'invalid-amount';

export interface Unassigned {
  index: number;
  ingredientId: Id;
  reason: UnassignedReason;
}

export interface SlotFill<R extends string = string> {
  slotId: Id;
  role: R;
  optional: boolean;
  /** Indexes into the spec's lines. */
  lineIndexes: number[];
  /** Sum of the lines' volumes; absent if the slot is empty or a line has no volume. */
  ml?: number;
  /** Why `ml` is absent although the slot has lines. */
  unmeasured?: UnmeasuredReason;
}

export interface SlotAssignment<R extends string = string> {
  /** One entry per slot of the template, in the template's order. */
  fills: SlotFill<R>[];
  unassigned: Unassigned[];
  emptyRequired: Id[];
  emptyOptional: Id[];
}

export type RatioStatus = 'reference' | 'within' | 'below' | 'above' | 'unmeasured' | 'empty';

export interface SlotRatio {
  slotId: Id;
  status: RatioStatus;
  /** Parts against the reference slot; absent for `empty` and `unmeasured`. */
  parts?: number;
  minParts: number;
  maxParts: number;
}

export interface Candidate<R extends string = string> {
  templateId: Id;
  /** 1 is the best of this result. */
  rank: number;
  /** True if no required slot is empty, no line is unassigned and every measured ratio is in its band. */
  fits: boolean;
  /** Empty required slots + unassigned lines + relative distance of each ratio outside its band. */
  distance: number;
  /** Relative distance of each measured ratio from the middle of its band; breaks ties of `distance`. */
  offset: number;
  assignment: SlotAssignment<R>;
  ratios: SlotRatio[];
}

export interface Chosen {
  templateId: Id;
  basis: 'explicit' | 'suggested';
  /** False if an explicit id names no template in the list. */
  known: boolean;
  /** For a suggestion: true if the next candidate had the same distance and offset and the id order decided. */
  tieBrokenById?: boolean;
}

export interface MatchResult<R extends string = string> {
  /** Absent is the normal "no template" outcome. */
  chosen?: Chosen;
  candidates: Candidate<R>[];
}
