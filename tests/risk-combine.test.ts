import { describe, it, expect } from 'vitest';
import { DEFAULT_CONFIG as config } from '../src/lib/risk-config.ts';
import {
  levelRank,
  levelFromPoints,
  adjustLevel,
  lightMultiplier,
  treatmentMultiplier,
} from '../src/lib/risk-combine.ts';

const rough = { windFromDegrees: 200, windSpeedMps: 9, lowCloudPercent: 90, visibilityKm: 3 };
const clear = { windFromDegrees: 10, windSpeedMps: 2, lowCloudPercent: 5, visibilityKm: 15 };
const everywhere = (fields) => ({ early: fields, middle: fields, late: fields });
const conditions = (overrides = {}) => ({
  night: '2026-10-16',
  migration: { level: 1 },
  weather: everywhere(rough),
  ...overrides,
});

describe('levelFromPoints', () => {
  it('uses the configured thresholds, inclusive at the lower edge', () => {
    const { elevated, high } = config.thresholds;
    expect(levelFromPoints(0, config.thresholds)).toBe('low');
    expect(levelFromPoints(elevated - 0.001, config.thresholds)).toBe('low');
    expect(levelFromPoints(elevated, config.thresholds)).toBe('elevated');
    expect(levelFromPoints(high - 0.001, config.thresholds)).toBe('elevated');
    expect(levelFromPoints(high, config.thresholds)).toBe('high');
  });

  it('ranks levels low, elevated, high', () => {
    expect(
      ['high', 'low', 'elevated'].sort((first, second) => levelRank(first) - levelRank(second)),
    ).toEqual(['low', 'elevated', 'high']);
  });
});

describe('adjustLevel', () => {
  it('caps a missing-migration night and says why (R22)', () => {
    const result = adjustLevel('high', { migration: undefined, weatherPoints: 0 }, config);
    expect(result.level).toBe(config.missingMigrationCap);
    expect(result.notes).toContain('missingMigration');
  });

  it('caps a light-migration night below high (R15)', () => {
    const result = adjustLevel('high', { migration: 0.1, weatherPoints: 0 }, config);
    expect(result.level).toBe(config.weatherOnly.capLevel);
  });

  it('leaves a moderate or heavy night alone', () => {
    expect(adjustLevel('high', { migration: 0.5, weatherPoints: 0 }, config).level).toBe('high');
    expect(adjustLevel('low', { migration: 0.9, weatherPoints: 0 }, config).level).toBe('low');
  });

  it('raises a low level to the floor when weather adds enough points (R15)', () => {
    const points = config.weatherOnly.floorMinPoints;
    const raised = adjustLevel('low', { migration: 0.1, weatherPoints: points }, config);
    expect(raised.level).toBe(config.weatherOnly.floorLevel);
    expect(raised.notes).toContain('weatherOnlyElevated');
    const notRaised = adjustLevel('low', { migration: 0.1, weatherPoints: points - 0.01 }, config);
    expect(notRaised.level).toBe('low');
  });

  it('does not add the floor note when the level was already high enough', () => {
    const result = adjustLevel('elevated', { migration: 0.5, weatherPoints: 1 }, config);
    expect(result.notes).not.toContain('weatherOnlyElevated');
  });
});

describe('lightMultiplier (R14)', () => {
  it('is 1 in clear weather and above 1 with low cloud or low visibility', () => {
    expect(lightMultiplier(conditions({ weather: everywhere(clear) }), config).value).toBe(1);
    expect(lightMultiplier(conditions(), config).value).toBeGreaterThan(1);
  });

  it('grows with migration, so heavy nights get more of the effect', () => {
    const heavy = lightMultiplier(conditions({ migration: { level: 1 } }), config).value;
    const light = lightMultiplier(conditions({ migration: { level: 0 } }), config).value;
    expect(heavy).toBeGreaterThan(light);
    expect(light).toBeGreaterThan(1);
  });

  it('stays within the configured factors', () => {
    const { cloudFactor, visibilityFactor } = config.lightMultiplier;
    expect(lightMultiplier(conditions(), config).value).toBeLessThanOrEqual(
      cloudFactor * visibilityFactor,
    );
  });

  it('reports whether low cloud is active', () => {
    expect(lightMultiplier(conditions(), config).cloudActive).toBe(true);
    expect(lightMultiplier(conditions({ weather: everywhere(clear) }), config).cloudActive).toBe(
      false,
    );
  });
});

describe('treatmentMultiplier (R40)', () => {
  it('removes the configured share for partial and full treatment', () => {
    expect(treatmentMultiplier({ birdSafeTreatment: 'none' }, config).value).toBe(1);
    expect(treatmentMultiplier({ birdSafeTreatment: 'partial' }, config).value).toBeCloseTo(
      1 - config.treatmentDiscount.partial,
      9,
    );
    expect(treatmentMultiplier({ birdSafeTreatment: 'full' }, config).value).toBeCloseTo(
      1 - config.treatmentDiscount.full,
      9,
    );
  });

  it('treats a missing, unknown or look-alike status as none', () => {
    for (const status of [undefined, null, 'unknown', 'evidence', 42]) {
      const result = treatmentMultiplier({ birdSafeTreatment: status }, config);
      expect(result.value).toBe(1);
      expect(result.status).toBe('none');
    }
    expect(treatmentMultiplier(undefined, config).value).toBe(1);
  });

  it('never removes everything', () => {
    expect(treatmentMultiplier({ birdSafeTreatment: 'full' }, config).value).toBeGreaterThan(0);
  });
});
