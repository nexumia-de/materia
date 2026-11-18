// Compares two versions of a spec. Which spec fields are compared, and which
// line fields count as the amount beside amount and unit, is the domain's
// list (drinks: drink-specs/diff.ts).
import type {
  DiffDomain,
  DiffOptionsOf,
  FieldDiffOf,
  LineDiffOf,
  LineField,
  SpecDiffOf,
  VersionLine,
  VersionSpec,
} from './types';

const same = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);

/** Which parts of a matched pair of lines differ. */
function fieldsOf<L extends VersionLine>(
  before: L,
  after: L,
  amountKeys: readonly (keyof L)[],
): LineField[] {
  const out: LineField[] = [];
  if (before.ingredientId !== after.ingredientId) out.push('ingredient');
  if (
    before.amount !== after.amount ||
    before.amountMax !== after.amountMax ||
    before.unit !== after.unit ||
    amountKeys.some((k) => before[k] !== after[k])
  )
    out.push('amount');
  if (before.role !== after.role) out.push('role');
  if ((before.optional ?? false) !== (after.optional ?? false)) out.push('optional');
  if ((before.note ?? '') !== (after.note ?? '')) out.push('note');
  if (!same(before.substitutes ?? [], after.substitutes ?? [])) out.push('substitutes');
  return out;
}

/** The first unmatched older line that `accept` takes, marked as used. */
function take<L>(before: readonly L[], used: Set<number>, accept: (line: L) => boolean): number {
  const at = before.findIndex((line, i) => !used.has(i) && accept(line));
  if (at >= 0) used.add(at);
  return at;
}

/**
 * Compares two versions: lines added, removed and changed (another
 * ingredient, amount, role, optional flag, note or substitutes), then the
 * domain's spec fields. Lines are matched, not compared by position: first
 * identical lines, then lines of the same ingredient, then lines in the same
 * role, so a different order is no difference and a replaced ingredient
 * reads as one changed line.
 */
export function diffVersions<L extends VersionLine, S extends VersionSpec<L>, F extends string>(
  before: S,
  after: S,
  options: DiffOptionsOf<L>,
  domain: DiffDomain<L, S, F>,
): SpecDiffOf<L, F> {
  const roleOf = (line: L): string | undefined => options.roleOf?.(line) ?? line.role;
  const used = new Set<number>();
  const pairs = new Map<number, number>();
  const passes: ((a: L) => (b: L) => boolean)[] = [
    (a) => (b) => same(a, b),
    (a) => (b) => a.ingredientId === b.ingredientId,
    (a) => (b) => {
      const role = roleOf(a);
      return role !== undefined && role === roleOf(b);
    },
  ];
  for (const pass of passes) {
    after.lines.forEach((line, i) => {
      if (pairs.has(i)) return;
      const at = take(before.lines, used, pass(line));
      if (at >= 0) pairs.set(i, at);
    });
  }
  const lines: LineDiffOf<L>[] = [];
  after.lines.forEach((line, i) => {
    const at = pairs.get(i);
    if (at === undefined) {
      lines.push({ kind: 'added', after: line, fields: [] });
      return;
    }
    const old = before.lines[at] as L;
    const fields = fieldsOf(old, line, domain.amountKeys);
    if (fields.length > 0) lines.push({ kind: 'changed', before: old, after: line, fields });
  });
  before.lines.forEach((line, i) => {
    if (!used.has(i)) lines.push({ kind: 'removed', before: line, fields: [] });
  });
  const fields: FieldDiffOf<F>[] = [];
  for (const [field, read] of domain.fields) {
    const a = read(before) || undefined;
    const b = read(after) || undefined;
    if (a !== b) {
      fields.push({
        field,
        ...(a !== undefined && { before: a }),
        ...(b !== undefined && { after: b }),
      });
    }
  }
  return { lines, fields, empty: lines.length === 0 && fields.length === 0 };
}
