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
