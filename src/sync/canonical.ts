// Canonical JSON: object keys sorted, `undefined` dropped. Used to break ties
// the same way on every device and to write documents in a stable form.

/**
 * Copies a value deeply with object keys sorted and `undefined` members removed.
 * @param value Any JSON-like value.
 * @returns The copy; `undefined` in an array becomes `null`.
 */
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

/**
 * Writes the canonical JSON text of a value.
 * @param value Any JSON-like value.
 * @returns The text, or the empty string for `undefined`.
 */
export function canonicalJson(value: unknown): string {
  return value === undefined ? '' : JSON.stringify(sortedValue(value));
}

/**
 * Orders two strings by plain code-unit order, independent of locale.
 * @param a The first string.
 * @param b The second string.
 * @returns -1, 0 or 1.
 */
export const compareText = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);
