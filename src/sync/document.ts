// The plain document of one place, the text that gets encrypted
// (docs/sync.md#the-document). Parsing checks the frame; whether a single
// record is valid is decided by the merge, which reports it as rejected.

import { instantMs } from './instant';
import { isObj, movedText, objects, parseMoved, recordsByKey, text } from './frame';
import type { Place } from './places';
import type { SyncRecord } from './records';

/** The format name of a place document. */
export const DOCUMENT_FORMAT = 'materia-place';
/** The version of the place document this package reads and writes. */
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

/**
 * Parses the plain text; unknown top-level fields are ignored.
 * @param json The decrypted text.
 * @returns The place document, or the first problem found.
 */
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
    if (moved === 'bad') return { ok: false, error: 'invalid' };
    doc.moved = moved;
  }
  return { ok: true, document: doc };
}

/**
 * Writes the stable text: fixed key order, records and entities sorted by key, values with sorted keys.
 * @param doc The place document.
 * @returns The compact JSON text.
 */
export function buildDocument(doc: PlaceDocument): string {
  const { place, moved } = doc;
  return JSON.stringify({
    format: DOCUMENT_FORMAT,
    version: DOCUMENT_VERSION,
    place: { id: place.id, name: place.name, updatedAt: place.updatedAt },
    records: recordsByKey(doc.records),
    entities: recordsByKey(doc.entities),
    ...(moved ? { moved: movedText(moved) } : {}),
  });
}
