/**
 * Sunset and sunrise for a "night of" date: sunset on that date to sunrise on the next date.
 * Uses the suncalc package (pure maths, no network).
 */
import { getTimes } from 'suncalc';

const MILLISECONDS_PER_HOUR = 3_600_000;
const MILLISECONDS_PER_DAY = 86_400_000;
const NOON_HOUR = 12;
const DEGREES_PER_HOUR = 15;

/** Local solar noon of an ISO date, as a Date. Keeps suncalc on the right calendar day. */
function solarNoon(isoDate: string, longitude: number): Date {
  const [year, month, day] = isoDate.split('-').map(Number);
  const utcNoon = Date.UTC(year, month - 1, day, NOON_HOUR);
  return new Date(utcNoon - (longitude / DEGREES_PER_HOUR) * MILLISECONDS_PER_HOUR);
}

/**
 * @param {string} isoDate night-of date, 'YYYY-MM-DD'
 * @returns {{ sunset: Date, sunrise: Date }}
 * @throws {RangeError} when the sun does not set or rise (polar day or night); suncalc returns null then
 */
export function getNightTimes(
  isoDate: string,
  latitude: number,
  longitude: number,
): { sunset: Date; sunrise: Date } {
  const evening = solarNoon(isoDate, longitude);
  const nextDay = new Date(evening.getTime() + MILLISECONDS_PER_DAY);
  const sunset = getTimes(evening, latitude, longitude).sunset;
  const sunrise = getTimes(nextDay, latitude, longitude).sunrise;
  if (!(sunset instanceof Date) || !(sunrise instanceof Date)) {
    throw new RangeError(`No sunset or sunrise at latitude ${latitude} on ${isoDate}`);
  }
  return { sunset, sunrise };
}
