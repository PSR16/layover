import { describe, it, expect } from 'vitest';
import fastCheck from 'fast-check';
import { ranksOf, spearman, auc, topShare, levelBreakdown } from '../tools/calibration-metrics.ts';

describe('ranksOf', () => {
  it('ranks from 1 and gives ties the average rank', () => {
    expect(ranksOf([30, 10, 20])).toEqual([3, 1, 2]);
    expect(ranksOf([5, 5, 1, 5])).toEqual([3, 3, 1, 3]);
    expect(ranksOf([])).toEqual([]);
  });
});

const skewed = (list) => list.map((value, index) => value * (index % 3) - index);
const everyOther = (list) => list.map((value, index) => Number.isFinite(value) && index % 2 === 0);
const negated = (list) => list.map((value) => -value);

describe('spearman', () => {
  it('is 1 for the same order, -1 for the reverse order and 0 for a symmetric shuffle', () => {
    expect(spearman([1, 2, 3, 4], [10, 20, 30, 40])).toBeCloseTo(1, 9);
    expect(spearman([1, 2, 3, 4], [40, 30, 20, 10])).toBeCloseTo(-1, 9);
    expect(spearman([1, 2, 3], [2, 3, 2])).toBeCloseTo(0, 9);
  });

  it('is undefined when one list has no spread', () => {
    expect(spearman([1, 1, 1], [1, 2, 3])).toBeUndefined();
  });

  it('stays between -1 and 1 (property)', () => {
    const list = fastCheck.array(fastCheck.integer({ min: -50, max: 50 }), {
      minLength: 2,
      maxLength: 30,
    });
    fastCheck.assert(
      fastCheck.property(list, (first) => {
        const second = skewed(first);
        const rho = spearman(first, second);
        if (rho !== undefined) {
          expect(rho).toBeGreaterThanOrEqual(-1 - 1e-9);
          expect(rho).toBeLessThanOrEqual(1 + 1e-9);
        }
      }),
    );
  });
});

describe('auc', () => {
  it('is 1 when every positive night scores above every negative night', () => {
    expect(auc([5, 6, 1, 2], [true, true, false, false])).toBe(1);
  });

  it('is 0 when the order is reversed and 0.5 when everything ties', () => {
    expect(auc([1, 2, 5, 6], [true, true, false, false])).toBe(0);
    expect(auc([3, 3, 3, 3], [true, false, true, false])).toBe(0.5);
  });

  it('counts a mixed case by hand: positives 4 and 2 against negatives 3 and 1', () => {
    // pairs (4>3, 4>1, 2<3, 2>1) = 3 of 4
    expect(auc([4, 2, 3, 1], [true, true, false, false])).toBe(0.75);
  });

  it('is undefined with no positives or no negatives', () => {
    expect(auc([1, 2], [true, true])).toBeUndefined();
    expect(auc([1, 2], [false, false])).toBeUndefined();
  });

  it('turns into 1 minus itself when the scores are negated (property)', () => {
    const scores = fastCheck.array(fastCheck.integer({ min: -20, max: 20 }), {
      minLength: 4,
      maxLength: 20,
    });
    fastCheck.assert(
      fastCheck.property(scores, (list) => {
        const flags = everyOther(list);
        const forward = auc(list, flags);
        const backward = auc(negated(list), flags);
        expect(forward + backward).toBeCloseTo(1, 9);
      }),
    );
  });
});

describe('topShare', () => {
  it('gives the share of birds on the top-ranked nights', () => {
    expect(topShare([9, 1, 5, 3], [10, 0, 5, 5], 0.5)).toBeCloseTo(15 / 20, 9);
    expect(topShare([9, 1, 5, 3], [10, 0, 5, 5], 1)).toBe(1);
  });

  it('takes at least one night and is undefined with no birds', () => {
    expect(topShare([3, 2, 1], [0, 0, 6], 0.01)).toBe(0);
    expect(topShare([1, 2, 3], [0, 0, 6], 0.01)).toBe(1);
    expect(topShare([1, 2, 3], [0, 0, 0], 0.5)).toBeUndefined();
  });

  it('is best when scores follow the bird counts exactly', () => {
    const birds = [0, 3, 9, 1, 40, 2];
    expect(topShare(birds, birds, 1 / 6)).toBeCloseTo(40 / 55, 9);
  });
});

describe('levelBreakdown', () => {
  it('reports shares of nights and birds and the mean birds per level', () => {
    const result = levelBreakdown(['low', 'high', 'low', 'elevated'], [1, 14, 1, 4]);
    expect(result.low).toMatchObject({ nights: 0.5, meanBirds: 1 });
    expect(result.low.birds).toBeCloseTo(0.1, 9);
    expect(result.high.birds).toBeCloseTo(0.7, 9);
    expect(result.elevated.meanBirds).toBe(4);
  });

  it('copes with a level that never appears and with no birds', () => {
    const result = levelBreakdown(['low', 'low'], [0, 0]);
    expect(result.high).toEqual({ nights: 0, birds: 0, meanBirds: 0 });
    expect(result.low.birds).toBe(0);
  });
});
