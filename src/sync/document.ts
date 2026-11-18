// The plain document of one place, the text that gets encrypted
// (docs/sync.md#the-document). Parsing checks the frame; whether a single
// record is valid is decided by the merge, which reports it as rejected.

import { compareText, sortedValue } from './canonical';
import { instantMs } from './instant';
import type { Place } from './places';
import type { SyncRecord } from './records';

export const DOCUMENT_FORMAT = 'materia-place';
export const DOCUMENT_VERSION = 1;

export interface PlaceDocument<V = unknown, E = unknown> {
  format: 'materia-place';
  version: 1;
  place: Place;
  records: SyncRecord<V>[];
  /** Entities the records refer to (an app's custom ingredients), merged like records. */
  entities: SyncRecord<E>[];
  /** Set when the place moved to other storage: members are told to join again. */
  moved?: { at: string; note?: string };
}

export type DocumentError = 'not-json' | 'not-a-document' | 'newer-version' | 'invalid';

type Obj = Record<string, unknown>;
const isObj = (x: unknown): x is Obj => x !== null && typeof x === 'object' && !Array.isArray(x);
const text = (x: unknown): x is string => typeof x === 'string' && x !== '';
const objects = (x: unknown): x is Obj[] => Array.isArray(x) && x.every(isObj);

function parseMoved(x: unknown): PlaceDocument['moved'] | 'bad' {
  if (!isObj(x) || instantMs(x.at) === undefined) return 'bad';
  if (x.note !== undefined && typeof x.note !== 'string') return 'bad';
  return x.note === undefined ? { at: x.at as string } : { at: x.at as string, note: x.note };
}

/** Parses the plain text; unknown top-level fields are ignored. */
export function parseDocument(
  json: string,
): { ok: true; document: PlaceDocument } | { ok: false; error: DocumentError } {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return { ok: false, error: 'not-json' };
  }
  if (!isObj(raw) || raw.format !== DOCUMENT_FORMAT) return { ok: false, error: 'not-a-document' };
  if (typeof raw.version === 'number' && raw.version > DOCUMENT_VERSION) {
    return { ok: false, error: 'newer-version' };
  }
  const p = raw.place;
  if (
    raw.version !== DOCUMENT_VERSION ||
    !isObj(p) ||
    !text(p.id) ||
    typeof p.name !== 'string' ||
    instantMs(p.updatedAt) === undefined ||
    !objects(raw.records) ||
    !objects(raw.entities)
  ) {
    return { ok: false, error: 'invalid' };
  }
  const doc: PlaceDocument = {
    format: DOCUMENT_FORMAT,
    version: DOCUMENT_VERSION,
    place: { id: p.id, name: p.name, updatedAt: p.updatedAt as string },
    records: raw.records as unknown as SyncRecord[],
    entities: raw.entities as unknown as SyncRecord[],
  };
  if (raw.moved !== undefined) {
    const moved = parseMoved(raw.moved);
    if (moved === 'bad' || moved === undefined) return { ok: false, error: 'invalid' };
    doc.moved = moved;
  }
  return { ok: true, document: doc };
}

const clean = (r: SyncRecord): unknown => ({
  key: r.key,
  updatedAt: r.updatedAt,
  ...(r.deleted === true ? { deleted: true } : {}),
  ...(r.value === undefined ? {} : { value: sortedValue(r.value) }),
});

const byKey = (list: readonly SyncRecord[]): unknown[] =>
  [...list].sort((a, b) => compareText(String(a.key), String(b.key))).map(clean);

/** The stable text: fixed key order, records and entities sorted by key, values with sorted keys. */
export function buildDocument(doc: PlaceDocument): string {
  const { place, moved } = doc;
  return JSON.stringify({
    format: DOCUMENT_FORMAT,
    version: DOCUMENT_VERSION,
    place: { id: place.id, name: place.name, updatedAt: place.updatedAt },
    records: byKey(doc.records),
    entities: byKey(doc.entities),
    ...(moved
      ? { moved: { at: moved.at, ...(moved.note === undefined ? {} : { note: moved.note }) } }
      : {}),
  });
}
