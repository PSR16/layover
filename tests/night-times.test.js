import { describe, it, expect } from 'vitest';
import { getNightTimes } from '../src/lib/night-times.js';

const CHICAGO = { latitude: 41.88, longitude: -87.63 };
const HOUR = 3_600_000;

describe('getNightTimes', () => {
  it('gives Chicago sunset in the evening and sunrise the next morning (2026-10-17)', () => {
    const { sunset, sunrise } = getNightTimes('2026-10-17', CHICAGO.latitude, CHICAGO.longitude);
    // Central Daylight Time is UTC-5, so about 18:05 local sunset and 07:06 local sunrise.
    expect(sunset.toISOString().slice(0, 13)).toBe('2026-10-17T23');
    expect(sunrise.toISOString().slice(0, 13)).toBe('2026-10-18T12');
  });

  it('gives a night between 9 and 15 hours long in migration seasons', () => {
    for (const date of ['2026-03-20', '2026-05-10', '2026-09-20', '2026-11-10']) {
      const { sunset, sunrise } = getNightTimes(date, CHICAGO.latitude, CHICAGO.longitude);
      const hours = (sunrise.getTime() - sunset.getTime()) / HOUR;
      expect(hours).toBeGreaterThan(9);
      expect(hours).toBeLessThan(15);
    }
  });

  it('throws when the sun never sets', () => {
    expect(() => getNightTimes('2026-06-21', 80, 0)).toThrow(RangeError);
  });
});
