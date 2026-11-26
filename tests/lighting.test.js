import { describe, it, expect } from 'vitest';
import fastCheck from 'fast-check';
import { isLitCode, litShare } from '../src/lib/lighting.js';

const CODES = ['YN', 'YY', 'NN', 'NY', 'DN', 'DY', 'VDN', 'QY', 'QN'];

describe('isLitCode', () => {
  it('counts only YN as lit (R39)', () => {
    expect(isLitCode('YN')).toBe(true);
    expect(isLitCode(' yn ')).toBe(true);
    for (const code of CODES.filter((entry) => entry !== 'YN')) {
      expect(isLitCode(code)).toBe(false);
    }
    expect(isLitCode(undefined)).toBe(false);
  });
});

describe('litShare', () => {
  it('counts dim and covered windows as unlit', () => {
    const windows = [{ code: 'YN' }, { code: 'DN' }, { code: 'YY' }, { code: 'NN' }];
    expect(litShare(windows)).toBeCloseTo(0.25, 9);
  });

  it('weights windows by size', () => {
    expect(
      litShare([
        { code: 'YN', size: 3 },
        { code: 'NN', size: 1 },
      ]),
    ).toBeCloseTo(0.75, 9);
  });

  it('leaves questionable records out of the share', () => {
    expect(litShare([{ code: 'YN' }, { code: 'QN' }])).toBe(1);
    expect(litShare([{ code: 'QN' }])).toBeUndefined();
  });

  it('gives undefined when there is nothing to measure', () => {
    expect(litShare([])).toBeUndefined();
    expect(litShare(undefined)).toBeUndefined();
  });

  it('always stays between 0 and 1', () => {
    const windowArbitrary = fastCheck.record({
      code: fastCheck.constantFrom(...CODES),
      size: fastCheck.double({ min: 0.1, max: 50, noNaN: true }),
    });
    fastCheck.assert(
      fastCheck.property(fastCheck.array(windowArbitrary), (windows) => {
        const share = litShare(windows);
        if (share !== undefined) {
          expect(share).toBeGreaterThanOrEqual(0);
          expect(share).toBeLessThanOrEqual(1);
        }
      }),
    );
  });

  it('is unchanged when covered or dim windows are added (they add no lit area)', () => {
    const base = [
      { code: 'YN', size: 2 },
      { code: 'NN', size: 2 },
    ];
    const withDim = [...base, { code: 'DN', size: 0 }];
    expect(litShare(withDim)).toBe(litShare(base));
  });
});
