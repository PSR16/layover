import { describe, it, expect } from 'vitest';
import fastCheck from 'fast-check';
import { localDate, nightOfTonight } from '../src/lib/tonight.ts';

const CHICAGO = { latitude: 41.88, longitude: -87.63, timeZone: 'America/Chicago' };
// 2026-11-26: Chicago sunset about 22:22Z (4:22 pm), next sunrise about 12:54Z (6:54 am).
const nightAt = (utc) => nightOfTonight(new Date(utc), CHICAGO);

describe('localDate', () => {
  it('uses the date in the given time zone, not UTC', () => {
    expect(localDate(new Date('2026-11-27T03:00:00Z'), 'America/Chicago')).toBe('2026-11-26');
    expect(localDate(new Date('2026-11-27T07:00:00Z'), 'America/Chicago')).toBe('2026-11-27');
    expect(localDate(new Date('2026-11-27T03:00:00Z'), 'UTC')).toBe('2026-11-27');
  });
});

describe('nightOfTonight', () => {
  it('picks this evening during the afternoon', () => {
    expect(nightAt('2026-11-26T20:00:00Z')).toBe('2026-11-26');
  });

  it('keeps the same night through the evening and past midnight', () => {
    expect(nightAt('2026-11-26T23:30:00Z')).toBe('2026-11-26');
    expect(nightAt('2026-11-27T05:00:00Z')).toBe('2026-11-26');
    expect(nightAt('2026-11-27T12:30:00Z')).toBe('2026-11-26');
  });

  it('switches to the coming evening once the sun is up', () => {
    expect(nightAt('2026-11-27T13:30:00Z')).toBe('2026-11-27');
  });

  it('is never more than one day away from the local date and never goes backwards (property)', () => {
    const minute = fastCheck.integer({ min: 0, max: 60 * 24 * 40 });
    fastCheck.assert(
      fastCheck.property(minute, (offset) => {
        const now = new Date(Date.parse('2026-10-01T00:00:00Z') + offset * 60_000);
        const night = nightOfTonight(now, CHICAGO);
        const today = localDate(now, CHICAGO.timeZone);
        expect([
          today,
          localDate(new Date(now.getTime() - 86_400_000), CHICAGO.timeZone),
        ]).toContain(night);
        const later = nightOfTonight(new Date(now.getTime() + 3_600_000), CHICAGO);
        expect(later >= night).toBe(true);
      }),
    );
  });
});
