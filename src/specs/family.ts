import type { Family, FamilySpec } from './types';

interface Node {
  lineageId: string;
  /** The first (lowest) version present: its `parentId` is the riff link. */
  first: FamilySpec;
}

function nodesOf(specs: readonly FamilySpec[]): Map<string, Node> {
  const nodes = new Map<string, Node>();
  for (const spec of specs) {
    const known = nodes.get(spec.lineageId);
    if (!known || spec.version < known.first.version) {
      nodes.set(spec.lineageId, { lineageId: spec.lineageId, first: spec });
    }
  }
  return nodes;
}

const byCreation =
  (nodes: Map<string, Node>) =>
  (a: string, b: string): number => {
    const x = nodes.get(a)?.first.createdAt ?? '';
    const y = nodes.get(b)?.first.createdAt ?? '';
    return x < y ? -1 : x > y ? 1 : a < b ? -1 : a > b ? 1 : 0;
  };

/** The lineage a drink is a riff of, or the parent spec id that is not in the data. */
function parentOf(
  node: Node,
  byId: Map<string, FamilySpec>,
): { lineageId: string } | { missing: string } | undefined {
  const id = node.first.parentId;
  if (id === undefined) return undefined;
  const parent = byId.get(id);
  return parent ? { lineageId: parent.lineageId } : { missing: id };
}

/**
 * The family of one drink: the chain of parents above it, its riffs and the
 * other riffs of its parent. A drink is a riff when its first version has a
 * `parentId`; the parent is the lineage of that spec, so a riff of a riff
 * gives a chain. A parent that is not in the data ends the chain
 * (`missingParent`); a loop in the chain is reported in `cycle` and the chain
 * stops before it repeats.
 *
 * @param specs Every known spec, all versions (seed specs included).
 * @param lineageId The drink whose family is wanted.
 * @returns The ancestors, riffs and siblings as lineage ids.
 */
export function buildFamily(specs: readonly FamilySpec[], lineageId: string): Family {
  const nodes = nodesOf(specs);
  const byId = new Map(specs.map((s) => [s.id, s]));
  const family: Family = { lineageId, ancestors: [], siblings: [], children: [] };
  const node = nodes.get(lineageId);
  if (!node) return family;
  const seen = new Set<string>([lineageId]);
  const chain: string[] = [];
  let at: Node | undefined = node;
  while (at) {
    const parent = parentOf(at, byId);
    if (!parent) break;
    if ('missing' in parent) {
      family.missingParent = parent.missing;
      break;
    }
    if (seen.has(parent.lineageId)) {
      const path = [lineageId, ...chain];
      family.cycle = path.slice(path.indexOf(parent.lineageId));
      break;
    }
    seen.add(parent.lineageId);
    chain.push(parent.lineageId);
    at = nodes.get(parent.lineageId);
  }
  family.ancestors = chain.reverse();
  const order = byCreation(nodes);
  const kids = (parent: string): string[] =>
    [...nodes.values()]
      .filter((n) => {
        const p = parentOf(n, byId);
        return (
          p !== undefined && 'lineageId' in p && p.lineageId === parent && n.lineageId !== parent
        );
      })
      .map((n) => n.lineageId)
      .sort(order);
  family.children = kids(lineageId);
  const direct = family.ancestors.at(-1);
  if (direct !== undefined) family.siblings = kids(direct).filter((id) => id !== lineageId);
  return family;
}

/**
 * Finds every loop of riffs (a drink that is its own ancestor), for imported
 * data; the app never creates one.
 *
 * @param specs Every known spec, all versions.
 * @returns One list of lineage ids per loop, in the order they repeat, sorted.
 */
export function findFamilyCycles(specs: readonly FamilySpec[]): string[][] {
  const nodes = nodesOf(specs);
  const byId = new Map(specs.map((s) => [s.id, s]));
  const found = new Map<string, string[]>();
  for (const start of nodes.keys()) {
    const path: string[] = [];
    let at: string | undefined = start;
    while (at !== undefined && !path.includes(at)) {
      path.push(at);
      const parent: ReturnType<typeof parentOf> = parentOf(nodes.get(at) as Node, byId);
      at = parent && 'lineageId' in parent ? parent.lineageId : undefined;
    }
    if (at !== undefined) {
      const loop = path.slice(path.indexOf(at));
      const key = [...loop].sort().join('|');
      if (!found.has(key)) found.set(key, [...loop].sort());
    }
  }
  return [...found.values()].sort((a, b) => a.join('|').localeCompare(b.join('|')));
}
