// Order of two instants without a Date object: the form
// `YYYY-MM-DDThh:mm:ss[.fff]Z` (UTC) is fixed, so the day number of the date
// plus the time of day in milliseconds is enough.

import { dayNumber } from '../shelf/dates';

const PATTERN = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?Z$/;
const DAY_MS = 86_400_000;

/**
 * Converts a UTC timestamp to milliseconds since an arbitrary origin, enough to order two instants.
 * @param text The candidate, `YYYY-MM-DDThh:mm:ss[.fff]Z`.
 * @returns The milliseconds, or undefined when the value is not such a timestamp.
 */
export function instantMs(text: unknown): number | undefined {
  const m = typeof text === 'string' ? PATTERN.exec(text) : null;
  if (!m) return undefined;
  const day = dayNumber(m[1] as string);
  const [h, min, s] = [Number(m[2]), Number(m[3]), Number(m[4])];
  if (day === undefined || h > 23 || min > 59 || s > 59) return undefined;
  const ms = Number(((m[5] ?? '') + '000').slice(0, 3));
  return day * DAY_MS + ((h * 60 + min) * 60 + s) * 1000 + ms;
}
