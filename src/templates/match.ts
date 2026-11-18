// Scores a spec against templates by role coverage and ratio fit and returns
// every candidate with its numbers, best first. Deterministic: the order is
// distance, then offset, then template id.
import type { IngredientTreeOf } from '../ingredients/tree';
import type { BaseIngredient } from '../ingredients/types';
import { fillSlots } from './slots';
import type {
  Candidate,
  LineMeasure,
  MatchDomain,
  MatchResult,
  MatchSpec,
  RatioStatus,
  SlotRatio,
  Template,
} from './types';

/** Floating point noise must not decide a tie. */
const round = (n: number) => Math.round(n * 1e9) / 1e9;

type RoledTree<R extends string> = IngredientTreeOf<BaseIngredient & { role?: R }>;

function evaluate<R extends string>(
  tree: RoledTree<R>,
  template: Template<R>,
  spec: MatchSpec<R>,
  measure: LineMeasure<R>,
  referenceRole: R,
): Omit<Candidate<R>, 'rank'> {
  const assignment = fillSlots(tree, template, spec.lines, measure);
  const refIndex = template.slots.findIndex((s) => s.role === referenceRole);
  const ref = template.slots[refIndex];
  const refMl = assignment.fills[refIndex]?.ml;
  const refParts = ref ? (ref.minParts + ref.maxParts) / 2 : 0;
  let miss = 0;
  let offset = 0;
  const ratios: SlotRatio[] = template.slots.map((slot, i) => {
    const fill = assignment.fills[i];
    const bounds = { slotId: slot.id, minParts: slot.minParts, maxParts: slot.maxParts };
    if (!fill) return { ...bounds, status: 'empty' };
    if (fill.lineIndexes.length === 0) return { ...bounds, status: 'empty' };
    if (i === refIndex) return { ...bounds, status: 'reference', parts: refParts };
    if (fill.ml === undefined || refMl === undefined || refMl <= 0) {
      return { ...bounds, status: 'unmeasured' };
    }
    const parts = (refParts * fill.ml) / refMl;
    let status: RatioStatus = 'within';
    if (parts < slot.minParts) {
      status = 'below';
      miss += (slot.minParts - parts) / slot.minParts;
    } else if (parts > slot.maxParts) {
      status = 'above';
      miss += (parts - slot.maxParts) / slot.maxParts;
    }
    const mid = (slot.minParts + slot.maxParts) / 2;
    offset += Math.abs(parts - mid) / mid;
    return { ...bounds, status, parts };
  });
  const distance = round(assignment.emptyRequired.length + assignment.unassigned.length + miss);
  return {
    templateId: template.id,
    fits: distance === 0,
    distance,
    offset: round(offset),
    assignment,
    ratios,
  };
}

function rank<R extends string>(list: Omit<Candidate<R>, 'rank'>[]): Candidate<R>[] {
  return [...list]
    .sort(
      (a, b) =>
        a.distance - b.distance ||
        a.offset - b.offset ||
        (a.templateId < b.templateId ? -1 : a.templateId > b.templateId ? 1 : 0),
    )
    .map((c, i) => ({ ...c, rank: i + 1 }));
}

/**
 * The templates a spec is tried against. Variants (a variant class set) are offered only for their class, and
 * then they replace their parent: same slots, so both would tie on every spec and the id would decide.
 */
function offered<T extends { id: string; parentId?: string }>(
  templates: readonly T[],
  classOf: (t: T) => string | undefined,
  wanted: string | undefined,
): T[] {
  return templates.filter((t) => {
    const c = classOf(t);
    return c !== undefined
      ? c === wanted
      : !templates.some((v) => {
          const vc = classOf(v);
          return v.parentId === t.id && vc !== undefined && vc === wanted;
        });
  });
}

/**
 * Matches a spec to templates by roles and ratios and ranks every candidate.
 * Lines are measured with `measure`; ratios are parts against the slot of the domain's reference role;
 * variants of the class `wanted` are offered in place of their parents.
 */
export function matchTemplates<R extends string, T extends Template<R>>(
  tree: RoledTree<R>,
  templates: readonly T[],
  spec: MatchSpec<R>,
  measure: LineMeasure<R>,
  domain: MatchDomain<R, T>,
  wanted: string | undefined,
): MatchResult<R> {
  if (spec.templateId !== undefined) {
    const own = templates.find((t) => t.id === spec.templateId);
    if (!own) {
      return {
        chosen: { templateId: spec.templateId, basis: 'explicit', known: false },
        candidates: [],
      };
    }
    return {
      chosen: { templateId: own.id, basis: 'explicit', known: true },
      candidates: rank([evaluate(tree, own, spec, measure, domain.referenceRole)]),
    };
  }
  const candidates = rank(
    offered(templates, (t) => domain.variantClass(t), wanted).map((t) =>
      evaluate(tree, t, spec, measure, domain.referenceRole),
    ),
  );
  const best = candidates[0];
  if (!best || !best.fits) return { candidates };
  const next = candidates[1];
  const tie = next !== undefined && next.distance === best.distance && next.offset === best.offset;
  return {
    chosen: {
      templateId: best.templateId,
      basis: 'suggested',
      known: true,
      ...(tie ? { tieBrokenById: true } : {}),
    },
    candidates,
  };
}
