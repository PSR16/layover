/**
 * Which night counts as "tonight" (R29). A night runs from sunset to the next sunrise, so at
 * 2 a.m. the current night started yesterday evening, and at noon tonight is the one that
 * starts this evening. Pure logic: the clock is passed in.
 */
import { getNightTimes } from './night-times.js';

const MILLISECONDS_PER_DAY = 86_400_000;
const ISO_DATE_LENGTH = 10;

/** Calendar date ('YYYY-MM-DD') of a moment in a time zone such as 'America/Chicago'. */
export function localDate(moment, timeZone) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(moment);
}

function dayBefore(isoDate) {
  return new Date(Date.parse(`${isoDate}T00:00:00Z`) - MILLISECONDS_PER_DAY)
    .toISOString()
    .slice(0, ISO_DATE_LENGTH);
}

/**
 * The night-of date for "tonight": the earliest recent night whose sunrise is still ahead.
 * @param {Date} now
 * @param {{ latitude: number, longitude: number, timeZone: string }} location
 * @returns {string} 'YYYY-MM-DD'
 */
export function nightOfTonight(now, location) {
  const today = localDate(now, location.timeZone);
  const candidates = [dayBefore(today), today];
  const current = candidates.find((night) => {
    const { sunrise } = getNightTimes(night, location.latitude, location.longitude);
    return sunrise.getTime() > now.getTime();
  });
  return current ?? today;
}
