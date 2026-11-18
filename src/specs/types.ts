// Types of the specs module: comparing two versions of a spec and building
// its family (docs/screens-specs.md, docs/engine.md). Only the fields the
// functions read are named, so a stored spec fits as it is. The drink
// fields (`topMl`, `method`, `glass`, `garnish`) are in drink-specs/types.ts.

/** The general part of a spec line a comparison reads; a domain adds its own amount fields. */
export interface VersionLine {
  ingredientId: string;
  amount: number;
  amountMax?: number;
  unit: string;
  role?: string;
  optional?: boolean;
  note?: string;
  substitutes?: readonly { ingredientId: string; amount?: number; unit?: string }[];
}

/** The general part of a spec a comparison reads; a domain adds its own fields. */
export interface VersionSpec<L extends VersionLine = VersionLine> {
  name?: string;
  templateId?: string;
  lines: readonly L[];
  notes?: string;
}

/** What differs on a line that exists on both sides. */
export type LineField = 'ingredient' | 'amount' | 'role' | 'optional' | 'note' | 'substitutes';

export interface LineDiffOf<L extends VersionLine = VersionLine> {
  kind: 'added' | 'removed' | 'changed';
  /** The line in the older spec; absent when added. */
  before?: L;
  /** The line in the newer spec; absent when removed. */
  after?: L;
  /** What differs, for `changed` only. */
  fields: LineField[];
}

export interface FieldDiffOf<F extends string = string> {
  field: F;
  /** The value in the older spec; absent when it had none. */
  before?: string;
  /** The value in the newer spec; absent when it has none. */
  after?: string;
}

export interface SpecDiffOf<L extends VersionLine = VersionLine, F extends string = string> {
  lines: LineDiffOf<L>[];
  fields: FieldDiffOf<F>[];
  /** True when nothing differs (a different order of lines is no difference). */
  empty: boolean;
}

export interface DiffOptionsOf<L extends VersionLine = VersionLine> {
  /** The role of a line, so a replaced ingredient in the same role reads as a change of that line. */
  roleOf?: (line: L) => string | undefined;
}

/** What a domain compares beside the lines: its spec fields in order, and extra amount fields of a line. */
export interface DiffDomain<L extends VersionLine, S extends VersionSpec<L>, F extends string> {
  /** Spec fields with how to read each, in the order they are reported. */
  fields: readonly (readonly [F, (s: S) => string | undefined])[];
  /** Line fields that count as part of the amount beside `amount`, `amountMax` and `unit` (drinks: `topMl`). */
  amountKeys: readonly (keyof L)[];
}

/** One entry of the list of changes of a riff. */
export type RiffChangeItemOf<L extends VersionLine = VersionLine, F extends string = string> =
  { type: 'line'; line: LineDiffOf<L> } | { type: 'field'; change: FieldDiffOf<F> };

export interface RiffChangeOf<L extends VersionLine = VersionLine, F extends string = string> {
  /** Number of entries: every changed, added or removed line counts once. */
  count: number;
  items: RiffChangeItemOf<L, F>[];
}

/** The part of a spec the family reads. */
export interface FamilySpec {
  id: string;
  lineageId: string;
  version: number;
  /** The spec this one was made from: for version 1 of a riff the parent spec. */
  parentId?: string;
  createdAt?: string;
}

export interface Family {
  lineageId: string;
  /** Lineage ids from the oldest known ancestor down to the direct parent. */
  ancestors: string[];
  /** The parent spec id the chain ends at when that spec is not in the data. */
  missingParent?: string;
  /** Other riffs of the same parent, in order of creation. */
  siblings: string[];
  /** Riffs of this drink, in order of creation. */
  children: string[];
  /** Lineage ids of a loop in the chain upward, when there is one; the chain stops before it repeats. */
  cycle?: string[];
}
