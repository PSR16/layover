import { describe, it, expect } from 'vitest';
import fastCheck from 'fast-check';
import { findSeason } from '../src/lib/season.ts';

const SEASONS = { fall: ['08-15', '11-30'], spring: ['03-15', '06-05'] };

describe('findSeason', () => {
  it('finds fall and spring inside their windows', () => {
    expect(findSeason('2026-10-17', SEASONS)).toBe('fall');
    expect(findSeason('2026-04-20', SEASONS)).toBe('spring');
  });

  it('includes the first and last day of each window', () => {
    expect(findSeason('2026-03-15', SEASONS)).toBe('spring');
    expect(findSeason('2026-06-05', SEASONS)).toBe('spring');
    expect(findSeason('2026-08-15', SEASONS)).toBe('fall');
    expect(findSeason('2026-11-30', SEASONS)).toBe('fall');
  });

  it('returns null outside both windows', () => {
    expect(findSeason('2026-01-10', SEASONS)).toBeNull();
    expect(findSeason('2026-07-04', SEASONS)).toBeNull();
    expect(findSeason('2026-03-14', SEASONS)).toBeNull();
    expect(findSeason('2026-12-01', SEASONS)).toBeNull();
  });

  it('rejects text that is not an ISO date', () => {
    expect(() => findSeason('10/17/2026', SEASONS)).toThrow(TypeError);
    expect(() => findSeason(undefined, SEASONS)).toThrow(TypeError);
  });

  it('gives the same season for the same month and day in any year', () => {
    fastCheck.assert(
      fastCheck.property(
        fastCheck.date({
          min: new Date('2000-01-01'),
          max: new Date('2030-12-31'),
          noInvalidDate: true,
        }),
        (date) => {
          const monthDay = date.toISOString().slice(5, 10);
          expect(findSeason(`2001-${monthDay}`, SEASONS)).toBe(
            findSeason(`2029-${monthDay}`, SEASONS),
          );
        },
      ),
    );
  });
});
