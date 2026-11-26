import { describe, it, expect } from 'vitest';
import fastCheck from 'fast-check';
import {
  normalizeDegrees,
  angleDifference,
  isInSector,
  isInAnySector,
  isWesterly,
  turnedUnfavorable,
  circularMeanDegrees,
} from '../src/lib/wind.js';

const anyDegrees = fastCheck.double({ min: -1000, max: 1000, noNaN: true });

describe('normalizeDegrees', () => {
  it('wraps angles into 0 up to 360', () => {
    expect(normalizeDegrees(360)).toBe(0);
    expect(normalizeDegrees(-10)).toBe(350);
    expect(normalizeDegrees(725)).toBe(5);
  });

  it('always lands in range', () => {
    fastCheck.assert(
      fastCheck.property(anyDegrees, (degrees) => {
        const result = normalizeDegrees(degrees);
        expect(result).toBeGreaterThanOrEqual(0);
        expect(result).toBeLessThan(360);
      }),
    );
  });
});

describe('angleDifference', () => {
  it('takes the short way round north', () => {
    expect(angleDifference(350, 10)).toBe(20);
    expect(angleDifference(0, 180)).toBe(180);
  });

  it('is symmetric and never above 180', () => {
    fastCheck.assert(
      fastCheck.property(anyDegrees, anyDegrees, (first, second) => {
        expect(angleDifference(first, second)).toBeCloseTo(angleDifference(second, first), 9);
        expect(angleDifference(first, second)).toBeLessThanOrEqual(180);
      }),
    );
  });
});

describe('isInSector', () => {
  it('handles a plain sector', () => {
    expect(isInSector(200, [135, 315])).toBe(true);
    expect(isInSector(100, [135, 315])).toBe(false);
    expect(isInSector(135, [135, 315])).toBe(true);
    expect(isInSector(315, [135, 315])).toBe(true);
  });

  it('handles a sector that crosses north (0/360 boundary)', () => {
    const northSector = [315, 45];
    expect(isInSector(350, northSector)).toBe(true);
    expect(isInSector(0, northSector)).toBe(true);
    expect(isInSector(30, northSector)).toBe(true);
    expect(isInSector(180, northSector)).toBe(false);
    expect(isInSector(-20, northSector)).toBe(true);
  });

  it('gives the same answer for an angle and the same angle plus a full turn', () => {
    fastCheck.assert(
      fastCheck.property(anyDegrees, (degrees) => {
        expect(isInSector(degrees, [225, 315])).toBe(isInSector(degrees + 360, [225, 315]));
      }),
    );
  });
});

describe('isInAnySector and isWesterly', () => {
  it('checks several sectors', () => {
    const springUnfavorable = [
      [315, 360],
      [0, 45],
      [225, 315],
    ];
    expect(isInAnySector(10, springUnfavorable)).toBe(true);
    expect(isInAnySector(270, springUnfavorable)).toBe(true);
    expect(isInAnySector(150, springUnfavorable)).toBe(false);
  });

  it('treats 270 degrees as westerly and 90 degrees as not', () => {
    expect(isWesterly(270)).toBe(true);
    expect(isWesterly(90)).toBe(false);
  });
});

describe('turnedUnfavorable', () => {
  const fallUnfavorable = [[135, 315]];

  it('is true when wind goes from a favorable to an unfavorable direction', () => {
    expect(turnedUnfavorable(10, 220, fallUnfavorable)).toBe(true);
  });

  it('is false when wind was already unfavorable, stays favorable, or improves', () => {
    expect(turnedUnfavorable(200, 220, fallUnfavorable)).toBe(false);
    expect(turnedUnfavorable(10, 20, fallUnfavorable)).toBe(false);
    expect(turnedUnfavorable(220, 10, fallUnfavorable)).toBe(false);
  });
});

describe('circularMeanDegrees', () => {
  it('averages across north correctly', () => {
    expect(circularMeanDegrees([350, 10])).toBeCloseTo(0, 6);
    expect(circularMeanDegrees([90, 270, 180])).toBeCloseTo(180, 6);
  });

  it('returns null for no data and for directions that cancel out', () => {
    expect(circularMeanDegrees([])).toBeNull();
    expect(circularMeanDegrees([0, 180])).toBeNull();
  });

  it('returns the same direction when all inputs match', () => {
    fastCheck.assert(
      fastCheck.property(fastCheck.double({ min: 0, max: 359, noNaN: true }), (degrees) => {
        const mean = circularMeanDegrees([degrees, degrees, degrees]);
        expect(angleDifference(mean, degrees)).toBeLessThan(1e-6);
      }),
    );
  });
});
