// Calendar-date arithmetic for shelf life, in whole numbers (days from civil
// date and back, the proleptic Gregorian calendar). Dates are plain
// `YYYY-MM-DD` strings supplied by the caller; nothing here uses a Date object,
// the clock or a time zone, so "today" is always an argument
// (docs/non-alcoholic.md#shelf-life-with-entered-dates).

const PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

const isLeap = (y: number): boolean => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
const monthDays = (y: number, m: number): number =>
  m === 2 ? (isLeap(y) ? 29 : 28) : [4, 6, 9, 11].includes(m) ? 30 : 31;

/** Days since 1970-01-01 of a valid civil date. */
function fromCivil(y: number, m: number, d: number): number {
  const yy = m <= 2 ? y - 1 : y;
  const era = Math.floor(yy / 400);
  const yoe = yy - era * 400;
  const doy = Math.floor((153 * (m + (m > 2 ? -3 : 9)) + 2) / 5) + d - 1;
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
  return era * 146097 + doe - 719468;
}

/** The civil date of a day number. */
function toCivil(n: number): { y: number; m: number; d: number } {
  const z = n + 719468;
  const era = Math.floor(z / 146097);
  const doe = z - era * 146097;
  const yoe = Math.floor(
    (doe - Math.floor(doe / 1460) + Math.floor(doe / 36524) - Math.floor(doe / 146096)) / 365,
  );
  const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100));
  const mp = Math.floor((5 * doy + 2) / 153);
  const d = doy - Math.floor((153 * mp + 2) / 5) + 1;
  const m = mp < 10 ? mp + 3 : mp - 9;
  return { y: yoe + era * 400 + (m <= 2 ? 1 : 0), m, d };
}

/**
 * Days since 1970-01-01 of a calendar date.
 *
 * @param text - A date as `YYYY-MM-DD`; it must be a real date (2027-02-29 is not).
 * @returns The day number, or undefined when the text is not a real date.
 */
export function dayNumber(text: string): number | undefined {
  const m = PATTERN.exec(text);
  if (!m) return undefined;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (mo < 1 || mo > 12 || d < 1 || d > monthDays(y, mo)) return undefined;
  return fromCivil(y, mo, d);
}

const two = (n: number): string => String(n).padStart(2, '0');

/**
 * The date some days after another.
 *
 * @param text - A date as `YYYY-MM-DD`.
 * @param days - Whole days to add (negative: before).
 * @returns The date as `YYYY-MM-DD`, or undefined for an invalid date or a non-integer count.
 */
export function addDays(text: string, days: number): string | undefined {
  const n = dayNumber(text);
  if (n === undefined || !Number.isInteger(days)) return undefined;
  const { y, m, d } = toCivil(n + days);
  return `${String(y).padStart(4, '0')}-${two(m)}-${two(d)}`;
}

/**
 * Whole days between two dates.
 *
 * @param from - A date as `YYYY-MM-DD`.
 * @param to - A date as `YYYY-MM-DD`.
 * @returns Days from `from` to `to` (negative when `to` is earlier), or undefined when either is not a real date.
 */
export function daysBetween(from: string, to: string): number | undefined {
  const a = dayNumber(from);
  const b = dayNumber(to);
  return a === undefined || b === undefined ? undefined : b - a;
}
