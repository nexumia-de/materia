// The small pieces the document files share: checks of a parsed frame and
// the stable text of a record list (docs/sync.md#the-document).

import { compareText, sortedValue } from './canonical';
import { instantMs } from './instant';
import type { SyncRecord } from './records';

/** A parsed JSON object with unknown members. */
export type Obj = Record<string, unknown>;

/**
 * Tells whether a parsed value is a plain object (not null, not an array).
 * @param x The parsed value.
 * @returns True for a plain object.
 */
export const isObj = (x: unknown): x is Obj =>
  x !== null && typeof x === 'object' && !Array.isArray(x);

/**
 * Tells whether a parsed value is a non-empty string.
 * @param x The parsed value.
 * @returns True for a non-empty string.
 */
export const text = (x: unknown): x is string => typeof x === 'string' && x !== '';

/**
 * Tells whether a parsed value is an array of plain objects.
 * @param x The parsed value.
 * @returns True for an array whose members are all plain objects.
 */
export const objects = (x: unknown): x is Obj[] => Array.isArray(x) && x.every(isObj);

/**
 * Reads the `moved` field of a document: a timestamp and an optional note.
 * @param x The parsed value of the field.
 * @returns The clean `{ at, note? }`, or `'bad'` when the field is broken.
 */
export function parseMoved(x: unknown): { at: string; note?: string } | 'bad' {
  if (!isObj(x) || instantMs(x.at) === undefined) return 'bad';
  if (x.note !== undefined && typeof x.note !== 'string') return 'bad';
  return x.note === undefined ? { at: x.at as string } : { at: x.at as string, note: x.note };
}

/**
 * Writes a `moved` field in its fixed key order.
 * @param moved The moved marker of a document.
 * @returns A copy with `at` first and the note only when there is one.
 */
export const movedText = (moved: { at: string; note?: string }): { at: string; note?: string } => ({
  at: moved.at,
  ...(moved.note === undefined ? {} : { note: moved.note }),
});

const clean = (r: SyncRecord): unknown => ({
  key: r.key,
  updatedAt: r.updatedAt,
  ...(r.deleted === true ? { deleted: true } : {}),
  ...(r.value === undefined ? {} : { value: sortedValue(r.value) }),
});

/**
 * Puts records into the stable form of a document.
 * @param list The records of a document.
 * @returns Copies sorted by key, with fixed field order and sorted value keys.
 */
export const recordsByKey = (list: readonly SyncRecord[]): unknown[] =>
  [...list].sort((a, b) => compareText(String(a.key), String(b.key))).map(clean);
