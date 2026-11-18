// Where a made batch stands against its shelf life, from dates the caller
// supplies. The shelf life is the user's own value: no number is proposed here
// (docs/non-alcoholic.md#shelf-life-with-entered-dates). A batch past its date is
// reported as a fact, not as a verdict about the drink or the user.
import type { Id } from '../ingredients/types';
import { addDays, daysBetween } from './dates';

/** Days before the use-by date from which a batch counts as "use soon". Assumption, unverified: no source gives a window; the caller may pass its own. */
export const USE_SOON_DAYS = 2;

export type ExpiryStatus = 'fresh' | 'use-soon' | 'past' | 'unknown';

export type ExpiryReason = 'no-shelf-life' | 'invalid-date' | 'invalid-shelf-life';

export interface ExpiryInput {
  /** The day the batch was made, `YYYY-MM-DD`. */
  madeOn: string;
  /** Today, `YYYY-MM-DD`, from the host. */
  today: string;
  /** The shelf life in whole days; absent when the user entered none. */
  shelfLifeDays?: number;
  /** The ingredient whose shelf life this is (the limiting one), passed through. */
  limitingId?: Id;
  /** Window of "use soon" in days; default `USE_SOON_DAYS`. */
  soonDays?: number;
}

export interface Expiry {
  status: ExpiryStatus;
  /** The last day the batch is within its shelf life: made on plus the shelf life. */
  useBy?: string;
  /** Days from today to the use-by date: 0 on the day itself, negative after it. */
  daysLeft?: number;
  limitingId?: Id;
  /** Why the status is `unknown`. */
  reason?: ExpiryReason;
}

/**
 * The state of one batch: `fresh`, `use-soon` (the use-by date is within the
 * window, today included) or `past` (the day after the use-by date and later).
 *
 * @param input - Dates and the user's shelf life; nothing is read from a clock.
 * @returns The status with the use-by date and the days left (negative once past), or `unknown` with the reason.
 */
export function expiry(input: ExpiryInput): Expiry {
  const { madeOn, today, shelfLifeDays } = input;
  const limiting = input.limitingId === undefined ? {} : { limitingId: input.limitingId };
  if (daysBetween(madeOn, today) === undefined) {
    return { status: 'unknown', reason: 'invalid-date', ...limiting };
  }
  if (shelfLifeDays === undefined)
    return { status: 'unknown', reason: 'no-shelf-life', ...limiting };
  if (!Number.isInteger(shelfLifeDays) || shelfLifeDays < 0) {
    return { status: 'unknown', reason: 'invalid-shelf-life', ...limiting };
  }
  const useBy = addDays(madeOn, shelfLifeDays) as string;
  const daysLeft = daysBetween(today, useBy) as number;
  const soon = input.soonDays ?? USE_SOON_DAYS;
  const status: ExpiryStatus = daysLeft < 0 ? 'past' : daysLeft <= soon ? 'use-soon' : 'fresh';
  return { status, useBy, daysLeft, ...limiting };
}
