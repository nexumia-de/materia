// The general document of a synced unit: a place, a library or a profile
// (docs/sync.md#unit-documents). Parsing checks the frame; whether a single
// record is valid is decided by the merge, which reports it as rejected.

import { compareText } from './canonical';
import { instantMs } from './instant';
import { isObj, movedText, objects, parseMoved, recordsByKey, text } from './frame';
import type { SyncRecord } from './records';

/** The format name of a unit document. */
export const UNIT_FORMAT = 'materia-unit';
/** The version of the unit document this package reads and writes. */
export const UNIT_VERSION = 1;

/** What a unit is for: a stock place, a collection library or a person's profile. */
export type UnitKind = 'place' | 'library' | 'profile';

const KINDS: readonly string[] = ['place', 'library', 'profile'];
const COLLECTION_NAME = /^[a-z][a-z0-9-]*$/;

/** Who and what a unit is; the name merges like a record. */
export interface UnitInfo {
  id: string;
  name: string;
  updatedAt: string;
}

export interface UnitDocument<V = unknown> {
  format: 'materia-unit';
  version: 1;
  kind: UnitKind;
  unit: UnitInfo;
  /** Named record lists; names match `/^[a-z][a-z0-9-]*$/`, unknown ones are carried through. */
  collections: Record<string, SyncRecord<V>[]>;
  /** Set when the unit moved to other storage: members are told to join again. */
  moved?: { at: string; note?: string };
}

export type UnitError = 'not-json' | 'not-a-unit' | 'newer-version' | 'unknown-kind' | 'invalid';

/**
 * Parses the plain text of a unit; unknown top-level fields are ignored and
 * unknown collections are kept.
 * @param json The decrypted text.
 * @returns The unit, or the first problem: not JSON, not a unit document,
 * a newer version, a kind this package does not know, or a broken frame.
 */
export function parseUnit(
  json: string,
): { ok: true; unit: UnitDocument } | { ok: false; error: UnitError } {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return { ok: false, error: 'not-json' };
  }
  if (!isObj(raw) || raw.format !== UNIT_FORMAT) return { ok: false, error: 'not-a-unit' };
  if (typeof raw.version === 'number' && raw.version > UNIT_VERSION) {
    return { ok: false, error: 'newer-version' };
  }
  if (typeof raw.kind === 'string' && !KINDS.includes(raw.kind)) {
    return { ok: false, error: 'unknown-kind' };
  }
  const u = raw.unit;
  const c = raw.collections;
  if (
    raw.version !== UNIT_VERSION ||
    typeof raw.kind !== 'string' ||
    !isObj(u) ||
    !text(u.id) ||
    typeof u.name !== 'string' ||
    instantMs(u.updatedAt) === undefined ||
    !isObj(c) ||
    !Object.entries(c).every(([name, list]) => COLLECTION_NAME.test(name) && objects(list))
  ) {
    return { ok: false, error: 'invalid' };
  }
  const collections: Record<string, SyncRecord[]> = {};
  for (const [name, list] of Object.entries(c)) collections[name] = list as unknown as SyncRecord[];
  const doc: UnitDocument = {
    format: UNIT_FORMAT,
    version: UNIT_VERSION,
    kind: raw.kind as UnitKind,
    unit: { id: u.id, name: u.name, updatedAt: u.updatedAt as string },
    collections,
  };
  if (raw.moved !== undefined) {
    const moved = parseMoved(raw.moved);
    if (moved === 'bad') return { ok: false, error: 'invalid' };
    doc.moved = moved;
  }
  return { ok: true, unit: doc };
}

/**
 * Writes the stable text of a unit: fixed key order, collection names
 * sorted, records sorted by key, values with sorted keys. Equal content
 * gives equal text.
 * @param unit The unit document.
 * @returns The compact JSON text.
 */
export function buildUnit(unit: UnitDocument): string {
  const { kind, moved } = unit;
  const collections: Record<string, unknown[]> = {};
  for (const name of Object.keys(unit.collections).sort(compareText)) {
    collections[name] = recordsByKey(unit.collections[name] as SyncRecord[]);
  }
  return JSON.stringify({
    format: UNIT_FORMAT,
    version: UNIT_VERSION,
    kind,
    unit: { id: unit.unit.id, name: unit.unit.name, updatedAt: unit.unit.updatedAt },
    collections,
    ...(moved ? { moved: movedText(moved) } : {}),
  });
}
