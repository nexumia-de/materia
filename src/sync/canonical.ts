// Canonical JSON: object keys sorted, `undefined` dropped. Used to break ties
// the same way on every device and to write documents in a stable form.

/** A deep copy with object keys sorted and `undefined` members removed. */
export function sortedValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((v) => (v === undefined ? null : sortedValue(v)));
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(value).sort()) {
      const v = (value as Record<string, unknown>)[k];
      if (v !== undefined) out[k] = sortedValue(v);
    }
    return out;
  }
  return value;
}

/** The canonical JSON text of a value; `undefined` gives the empty string. */
export function canonicalJson(value: unknown): string {
  return value === undefined ? '' : JSON.stringify(sortedValue(value));
}

/** Plain string order, independent of locale. */
export const compareText = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);
