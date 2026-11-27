import { describe, it, expect } from 'vitest';
import fastCheck from 'fast-check';
import { percentileRanker } from '../src/lib/percentile.js';

describe('percentileRanker', () => {
  it('ranks the lowest value near 0 and the highest near 1', () => {
    const rank = percentileRanker([10, 20, 30, 40]);
    expect(rank(10)).toBeCloseTo(0.125, 9);
    expect(rank(40)).toBeCloseTo(0.875, 9);
  });

  it('puts a value between two others between their ranks', () => {
    const rank = percentileRanker([10, 20, 30, 40]);
    expect(rank(25)).toBeCloseTo(0.5, 9);
  });

  it('gives tied values the middle of their range', () => {
    const rank = percentileRanker([5, 5, 5, 5]);
    expect(rank(5)).toBeCloseTo(0.5, 9);
  });

  it('ranks values outside the range at the ends', () => {
    const rank = percentileRanker([10, 20, 30]);
    expect(rank(-100)).toBe(0);
    expect(rank(1000)).toBe(1);
  });

  it('ignores missing values and returns undefined with nothing to rank', () => {
    const rank = percentileRanker([10, Number.NaN, undefined, 30, null]);
    expect(rank(20)).toBeCloseTo(0.5, 9);
    expect(percentileRanker([])(1)).toBeUndefined();
    expect(percentileRanker([1, 2])(Number.NaN)).toBeUndefined();
  });

  it('never lowers the rank when the value rises, and always stays between 0 and 1', () => {
    const numbers = fastCheck.array(fastCheck.double({ min: -1000, max: 1000, noNaN: true }), {
      minLength: 1,
    });
    const value = fastCheck.double({ min: -1500, max: 1500, noNaN: true });
    fastCheck.assert(
      fastCheck.property(numbers, value, value, (values, first, second) => {
        const rank = percentileRanker(values);
        const [low, high] = first <= second ? [first, second] : [second, first];
        expect(rank(high)).toBeGreaterThanOrEqual(rank(low));
        expect(rank(low)).toBeGreaterThanOrEqual(0);
        expect(rank(high)).toBeLessThanOrEqual(1);
      }),
    );
  });
});
