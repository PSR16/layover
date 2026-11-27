/**
 * Migration season from a calendar date. Pure logic, no clock access.
 * Season windows come from the risk config (evidence: E5 for fall versus spring,
 * dates are an assumption, see design section 5).
 */
import type { Season } from './types.ts';

const ISO_DATE_PATTERN = /^\d{4}-(\d{2}-\d{2})$/;

/** Return 'MM-DD' from an ISO date string, or throw for anything else. */
function monthAndDay(isoDate: unknown): string {
  const match = ISO_DATE_PATTERN.exec(String(isoDate));
  if (!match) {
    throw new TypeError(`Expected an ISO date like 2026-10-17, got: ${String(isoDate)}`);
  }
  return match[1];
}

function isInWindow(monthDay: string, window: readonly [string, string]): boolean {
  const [start, end] = window;
  return monthDay >= start && monthDay <= end;
}

/**
 * Find the season for an ISO date ('YYYY-MM-DD').
 * @param {string} isoDate
 * @param {{ spring: [string, string], fall: [string, string] }} seasons windows as 'MM-DD'
 * @returns {'spring' | 'fall' | null} null when the date is outside both windows
 */
export function findSeason(
  isoDate: unknown,
  seasons: Record<Season, [string, string]>,
): Season | null {
  const monthDay = monthAndDay(isoDate);
  if (isInWindow(monthDay, seasons.spring)) {
    return 'spring';
  }
  if (isInWindow(monthDay, seasons.fall)) {
    return 'fall';
  }
  return null;
}
