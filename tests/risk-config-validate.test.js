import { describe, it, expect } from 'vitest';
import { DEFAULT_CONFIG } from '../src/lib/risk-config.js';
import { validateConfig } from '../src/lib/risk-config-validate.js';

function changed(change) {
  const copy = structuredClone(DEFAULT_CONFIG);
  change(copy);
  return copy;
}

function problemsFor(change, options) {
  return validateConfig(changed(change), options);
}

describe('validateConfig on the default config', () => {
  it('finds no problems', () => {
    expect(validateConfig(DEFAULT_CONFIG)).toEqual([]);
  });

  it('rejects something that is not an object', () => {
    expect(validateConfig(null)).toEqual(['config must be an object']);
    expect(validateConfig([])).toEqual(['config must be an object']);
  });
});

describe('validateConfig rejection rules', () => {
  it('rule 1: a weight with no evidence is rejected', () => {
    const problems = problemsFor((config) => delete config.weights.wind.evidence);
    expect(problems).toContain(
      'weights.wind.evidence must list evidence IDs like "E1" or "assumption"',
    );
  });

  it('rule 1: a bad evidence entry is rejected, "assumption" is accepted', () => {
    expect(problemsFor((config) => (config.weights.tree.evidence = ['paper']))).not.toEqual([]);
    expect(problemsFor((config) => (config.weights.tree.evidence = ['assumption']))).toEqual([]);
    expect(problemsFor((config) => (config.weights.tree.evidence = []))).not.toEqual([]);
  });

  it('rule 1: evidence groups also need evidence', () => {
    const problems = problemsFor((config) => delete config.lightMultiplier.evidence);
    expect(problems).toContain(
      'lightMultiplier.evidence must list evidence IDs like "E1" or "assumption"',
    );
  });

  it('rule 2: migration must be the largest weight', () => {
    const problems = problemsFor((config) => (config.weights.litGlass.weight = 0.6));
    expect(problems).toContain('weights.litGlass.weight must be below weights.migration.weight');
  });

  it('rule 2: a tie with migration is rejected', () => {
    expect(problemsFor((config) => (config.weights.litGlass.weight = 0.45))).not.toEqual([]);
  });

  it('rule 2: a missing migration weight is reported', () => {
    expect(problemsFor((config) => delete config.weights.migration)).toContain(
      'weights.migration.weight is missing',
    );
  });

  it('rule 3: height must be below lit glass, stadium and trees', () => {
    expect(problemsFor((config) => (config.weights.height.weight = 0.3))).toContain(
      'weights.height.weight must be below weights.litGlass.weight',
    );
    expect(problemsFor((config) => (config.weights.height.weight = 0.06))).toContain(
      'weights.height.weight must be below weights.tree.weight',
    );
  });

  it('rule 3: the lakeshore weight must not be above lit glass', () => {
    const problems = problemsFor((config) => {
      config.weights.lakeshore.weight = 0.4;
    });
    expect(problems).toContain(
      'weights.lakeshore.weight must not be above weights.litGlass.weight',
    );
  });

  it('rule 4: thresholds must be ordered and inside 0 to 1', () => {
    const message = 'thresholds must satisfy 0 < elevated < high <= 1';
    expect(problemsFor((config) => (config.thresholds = { elevated: 0.7, high: 0.35 }))).toContain(
      message,
    );
    expect(problemsFor((config) => (config.thresholds = { elevated: 0.5, high: 0.5 }))).toContain(
      message,
    );
    expect(problemsFor((config) => (config.thresholds = { elevated: 0, high: 0.5 }))).toContain(
      message,
    );
    expect(problemsFor((config) => (config.thresholds = { elevated: 0.3, high: 1.2 }))).toContain(
      message,
    );
    expect(problemsFor((config) => delete config.thresholds)).toContain(message);
  });

  it('place thresholds must be ordered and not below the night thresholds', () => {
    const ordered = 'placeThresholds must satisfy 0 < elevated < high';
    expect(
      problemsFor((config) => (config.placeThresholds = { elevated: 1, high: 0.9 })),
    ).toContain(ordered);
    expect(problemsFor((config) => delete config.placeThresholds)).toContain(ordered);
    expect(
      problemsFor((config) => (config.placeThresholds = { elevated: 0.5, high: 1.4 })),
    ).toEqual([]);
    expect(
      problemsFor((config) => (config.placeThresholds = { elevated: 0.2, high: 1.4 })),
    ).toContain('placeThresholds must not be below thresholds');
    expect(
      problemsFor((config) => (config.placeThresholds = { elevated: 0.5, high: 0.45 })),
    ).not.toEqual([]);
  });

  it('rule 5: reason keys the factors need must have wording', () => {
    const options = { requiredReasonKeys: ['litGlass', 'brandNewReason'] };
    expect(validateConfig(DEFAULT_CONFIG, options)).toEqual([
      'reasons.brandNewReason is missing or empty',
    ]);
    const emptied = problemsFor((config) => (config.reasons.litGlass = '  '), options);
    expect(emptied).toContain('reasons.litGlass is missing or empty');
  });

  it('rule 6: each season needs wind sectors and a date window', () => {
    expect(problemsFor((config) => delete config.wind.fall)).toContain(
      'wind.fall.unfavorableFrom needs sectors like [135, 315]',
    );
    expect(problemsFor((config) => (config.wind.spring.unfavorableFrom = [[10, 400]]))).not.toEqual(
      [],
    );
    expect(problemsFor((config) => delete config.seasons.spring)).toContain(
      'seasons.spring needs a start and end like ["03-15", "06-05"]',
    );
    expect(problemsFor((config) => (config.seasons.fall = ['11-30', '08-15']))).not.toEqual([]);
  });

  it('night parts must add up to 1 with the middle part largest', () => {
    expect(problemsFor((config) => (config.nightParts.late = 0.5))).toContain(
      'nightParts early, middle and late must add up to 1',
    );
    const flat = problemsFor((config) =>
      Object.assign(config.nightParts, { early: 0.5, middle: 0.25, late: 0.25 }),
    );
    expect(flat).toContain('nightParts.middle must be the largest part');
  });

  it('weather scaling and light-wind share must be shares from 0 to 1', () => {
    expect(problemsFor((config) => (config.weatherScaling.minimum = 1.5))).toContain(
      'weatherScaling.minimum must be a number from 0 to 1',
    );
    expect(problemsFor((config) => delete config.wind.lightWindFactor)).toContain(
      'wind.lightWindFactor must be a number from 0 to 1',
    );
  });

  it('place settings must be well formed', () => {
    expect(problemsFor((config) => (config.weights.litGlass.reasonAbove = 2))).toContain(
      'weights.litGlass.reasonAbove must be a number from 0 to 1',
    );
    expect(problemsFor((config) => (config.weights.stadium.kinds = []))).toContain(
      'weights.stadium.kinds must list venue kinds like "stadium"',
    );
    expect(problemsFor((config) => (config.weights.height.fullAtMeters = 0))).toContain(
      'weights.height.fullAtMeters must be a number above 0',
    );
    expect(problemsFor((config) => delete config.weights.lakeshore.maxDistanceMeters)).toContain(
      'weights.lakeshore.maxDistanceMeters must be a number above 0',
    );
  });

  it('treatment discounts must be ordered and full must stay below 1 (R40)', () => {
    const message = 'treatmentDiscount must satisfy none = 0 <= partial <= full < 1';
    expect(problemsFor((config) => (config.treatmentDiscount.full = 1))).toContain(message);
    expect(problemsFor((config) => (config.treatmentDiscount.none = 0.1))).toContain(message);
    expect(problemsFor((config) => (config.treatmentDiscount.partial = 0.9))).toContain(message);
    expect(problemsFor((config) => delete config.treatmentDiscount)).toContain(message);
  });

  it('the weather-only floor must not be above the cap, and floorMinPoints must be a share', () => {
    expect(problemsFor((config) => (config.weatherOnly.capLevel = 'low'))).toContain(
      'weatherOnly.floorLevel must not be above weatherOnly.capLevel',
    );
    expect(problemsFor((config) => (config.weatherOnly.floorMinPoints = -1))).toContain(
      'weatherOnly.floorMinPoints must be a number from 0 to 1',
    );
  });

  it('carry-over must stay below the same-night wind weight (R18)', () => {
    expect(problemsFor((config) => (config.weights.carryOver.weight = 0.15))).toContain(
      'weights.carryOver.weight must be below weights.wind.weight',
    );
  });

  it('level names must be real levels', () => {
    expect(problemsFor((config) => (config.missingMigrationCap = 'severe'))).toContain(
      'missingMigrationCap must be one of low, elevated, high',
    );
    expect(problemsFor((config) => (config.weatherOnly.floorLevel = 'x'))).not.toEqual([]);
  });

  it('a weight outside 0 to 1 or not a number is rejected', () => {
    expect(problemsFor((config) => (config.weights.tree.weight = -0.1))).not.toEqual([]);
    expect(problemsFor((config) => (config.weights.tree.weight = '0.05'))).not.toEqual([]);
  });
});
