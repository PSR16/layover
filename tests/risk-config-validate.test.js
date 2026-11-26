import { describe, it, expect } from 'vitest';
import fastCheck from 'fast-check';
import { DEFAULT_CONFIG } from '../src/lib/risk-config.js';
import {
  validateConfig,
  mergeConfig,
  ConfigValidationError,
} from '../src/lib/risk-config-validate.js';

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

function withWeights(weights, thresholds) {
  return changed((copy) => {
    for (const [name, weight] of Object.entries(weights)) {
      copy.weights[name].weight = weight;
    }
    if (thresholds) {
      copy.thresholds = thresholds;
    }
  });
}

function migrationIsLargest(config) {
  const migration = config.weights.migration.weight;
  return Object.entries(config.weights)
    .filter(([name]) => name !== 'migration')
    .every(([, entry]) => entry.weight < migration);
}

function heightIsBelowGlassStadiumAndTrees(config) {
  const { height, litGlass, stadium, tree } = config.weights;
  return [litGlass, stadium, tree].every((entry) => height.weight < entry.weight);
}

describe('validateConfig properties (R32)', () => {
  const between = (min, max) => fastCheck.double({ min, max, noNaN: true });
  // Ranges chosen so a fair share of random configs is accepted and the rest are rejected.
  const weightsArbitrary = fastCheck.record({
    migration: between(0.3, 1),
    litGlass: between(0.05, 0.4),
    stadium: between(0.05, 0.4),
    tree: between(0.05, 0.4),
    height: between(0, 0.2),
  });
  const thresholdsArbitrary = fastCheck.record({
    elevated: between(0, 0.6),
    high: between(0.3, 1),
  });

  it('any config it accepts has migration largest, height below the others and ordered thresholds', () => {
    let acceptedCount = 0;
    fastCheck.assert(
      fastCheck.property(weightsArbitrary, thresholdsArbitrary, (weights, thresholds) => {
        const config = withWeights(weights, thresholds);
        if (validateConfig(config).length > 0) {
          return;
        }
        acceptedCount += 1;
        expect(migrationIsLargest(config)).toBe(true);
        expect(heightIsBelowGlassStadiumAndTrees(config)).toBe(true);
        expect(config.thresholds.elevated).toBeGreaterThan(0);
        expect(config.thresholds.high).toBeGreaterThan(config.thresholds.elevated);
      }),
      { numRuns: 300 },
    );
    expect(acceptedCount).toBeGreaterThan(10);
  });

  it('a config built to follow the rules is always accepted', () => {
    const small = fastCheck.double({ min: 0, max: 0.04, noNaN: true });
    const middle = fastCheck.double({ min: 0.06, max: 0.3, noNaN: true });
    fastCheck.assert(
      fastCheck.property(small, middle, middle, middle, (height, litGlass, stadium, tree) => {
        const config = withWeights({ height, litGlass, stadium, tree });
        config.weights.lakeshore.weight = Math.min(config.weights.lakeshore.weight, litGlass);
        expect(validateConfig(config)).toEqual([]);
      }),
    );
  });
});

describe('mergeConfig', () => {
  it('with no overrides returns a copy equal to the base', () => {
    const result = mergeConfig(DEFAULT_CONFIG);
    expect(result).toEqual(DEFAULT_CONFIG);
    expect(result).not.toBe(DEFAULT_CONFIG);
  });

  it('applies overrides without changing the base', () => {
    const before = structuredClone(DEFAULT_CONFIG);
    const result = mergeConfig(DEFAULT_CONFIG, {
      version: '0.2.0',
      weights: { wind: { weight: 0.2 } },
      thresholds: { high: 0.75 },
    });
    expect(result.version).toBe('0.2.0');
    expect(result.weights.wind.weight).toBeCloseTo(0.2, 9);
    expect(result.weights.wind.evidence).toEqual(DEFAULT_CONFIG.weights.wind.evidence);
    expect(result.thresholds).toEqual({ elevated: 0.35, high: 0.75 });
    expect(DEFAULT_CONFIG).toEqual(before);
  });

  it('replaces arrays instead of merging them', () => {
    const result = mergeConfig(DEFAULT_CONFIG, {
      wind: { fall: { unfavorableFrom: [[150, 300]] } },
    });
    expect(result.wind.fall.unfavorableFrom).toEqual([[150, 300]]);
  });

  it('throws with the full problem list when the result breaks a rule', () => {
    const attempt = () => mergeConfig(DEFAULT_CONFIG, { weights: { height: { weight: 0.9 } } });
    expect(attempt).toThrow(ConfigValidationError);
    try {
      attempt();
    } catch (error) {
      expect(error.problems.length).toBeGreaterThan(0);
      expect(error.message).toContain('weights.height.weight must be below');
    }
  });

  it('passes validation options through', () => {
    expect(() => mergeConfig(DEFAULT_CONFIG, {}, { requiredReasonKeys: ['nope'] })).toThrow(
      ConfigValidationError,
    );
  });

  it('ignores keys that could change object prototypes', () => {
    const hostile = JSON.parse('{"__proto__": {"polluted": true}, "constructor": {"x": 1}}');
    const result = mergeConfig(DEFAULT_CONFIG, hostile);
    expect({}.polluted).toBeUndefined();
    expect(Object.hasOwn(result, 'constructor')).toBe(false);
  });
});
