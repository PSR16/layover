import { describe, it, expect } from 'vitest';
import fastCheck from 'fast-check';
import { DEFAULT_CONFIG as config } from '../src/lib/risk-config.ts';
import { validateConfig } from '../src/lib/risk-config-validate.ts';
import { PLACE_FACTORS, PLACE_REASON_KEYS } from '../src/lib/risk-place-factors.ts';

const factorById = Object.fromEntries(PLACE_FACTORS.map((factor) => [factor.id, factor]));
const evaluate = (id, place, conditions) => factorById[id].evaluate(place, conditions, config);
const weight = (name) => config.weights[name].weight;

const westWind = { windFromDegrees: 270, windSpeedMps: 8 };
const eastWind = { windFromDegrees: 90, windSpeedMps: 8 };
const everywhere = (fields) => ({ early: fields, middle: fields, late: fields });
const conditions = (overrides = {}) => ({
  night: '2026-10-17',
  migration: { level: 1 },
  weather: everywhere(westWind),
  ...overrides,
});
const building = (overrides = {}) => ({
  id: 'b1',
  kind: 'building',
  lit: true,
  litGlassArea: 0.8,
  treeNear: false,
  heightMeters: 30,
  lakeDistanceMeters: null,
  ...overrides,
});
const unit = fastCheck.double({ min: 0, max: 1, noNaN: true });

describe('place factor registry', () => {
  it('has config wording for every reason key (validator rule 5)', () => {
    expect(validateConfig(config, { requiredReasonKeys: PLACE_REASON_KEYS })).toEqual([]);
  });
});

describe('place factor output shape (property)', () => {
  const maybe = (arbitrary) => fastCheck.option(arbitrary, { nil: undefined });
  const placeArbitrary = fastCheck.record({
    kind: fastCheck.constantFrom('building', 'stadium', 'arena', 'installation', 'park'),
    lit: maybe(fastCheck.boolean()),
    litGlassArea: maybe(fastCheck.double({ min: -1, max: 2, noNaN: true })),
    treeNear: maybe(fastCheck.boolean()),
    heightMeters: maybe(fastCheck.double({ min: -10, max: 800, noNaN: true })),
    lakeDistanceMeters: maybe(
      fastCheck.option(fastCheck.double({ min: -10, max: 5000, noNaN: true })),
    ),
  });

  it('always returns finite points of 0 or more, a known reason key and a missing list', () => {
    fastCheck.assert(
      fastCheck.property(placeArbitrary, (place) => {
        for (const factor of PLACE_FACTORS) {
          const output = factor.evaluate(place, conditions(), config);
          expect(Number.isFinite(output.points)).toBe(true);
          expect(output.points).toBeGreaterThanOrEqual(0);
          expect([null, ...factor.reasonKeys]).toContain(output.reasonKey);
          expect(Array.isArray(output.missing)).toBe(true);
        }
      }),
    );
  });

  it('copes with a missing place or missing conditions', () => {
    for (const factor of PLACE_FACTORS) {
      expect(() => factor.evaluate(undefined, undefined, config)).not.toThrow();
    }
  });
});

describe('lit glass factor (R12)', () => {
  it('gives points in proportion to lit glass', () => {
    expect(evaluate('litGlass', building({ litGlassArea: 0.5 })).points).toBeCloseTo(
      weight('litGlass') * 0.5,
      9,
    );
  });

  it('never gives fewer points for more lit glass', () => {
    fastCheck.assert(
      fastCheck.property(unit, unit, (first, second) => {
        const low = evaluate('litGlass', building({ litGlassArea: Math.min(first, second) }));
        const high = evaluate('litGlass', building({ litGlassArea: Math.max(first, second) }));
        expect(high.points).toBeGreaterThanOrEqual(low.points);
      }),
    );
  });

  it('gives nothing when the lights are off (E8)', () => {
    expect(evaluate('litGlass', building({ lit: false })).points).toBe(0);
  });

  it('counts a place with no lit flag as lit', () => {
    expect(evaluate('litGlass', building({ lit: undefined })).points).toBeGreaterThan(0);
  });

  it('shows the wording from the configured share, not below it', () => {
    expect(evaluate('litGlass', building({ litGlassArea: 0.6 })).reasonKey).toBe('litGlass');
    expect(evaluate('litGlass', building({ litGlassArea: 0.2 })).reasonKey).toBeNull();
  });

  it('reports a missing lit glass area', () => {
    const output = evaluate('litGlass', building({ litGlassArea: undefined }));
    expect(output.points).toBe(0);
    expect(output.missing).toEqual(['litGlassArea']);
  });
});

describe('tree factor (R21)', () => {
  it('raises the glass contribution when trees are close', () => {
    const output = evaluate('tree', building({ treeNear: true, litGlassArea: 1 }));
    expect(output.points).toBeCloseTo(weight('tree'), 9);
    expect(output.reasonKey).toBe('nearTrees');
  });

  it('adds nothing without trees, without glass, or when the lights are off', () => {
    expect(evaluate('tree', building({ treeNear: false })).points).toBe(0);
    expect(evaluate('tree', building({ treeNear: true, litGlassArea: 0 })).points).toBe(0);
    expect(evaluate('tree', building({ treeNear: true, lit: false })).points).toBe(0);
  });
});

describe('venue kind factor (R20)', () => {
  it('gives a lit stadium, arena or installation extra points over an ordinary building', () => {
    for (const kind of ['stadium', 'arena', 'installation']) {
      const output = evaluate('kind', building({ kind }));
      expect(output.points).toBeCloseTo(weight('stadium'), 9);
      expect(output.reasonKey).toBe('stadium');
    }
    expect(evaluate('kind', building()).points).toBe(0);
  });

  it('gives nothing for a stadium with its lights off (E8)', () => {
    expect(evaluate('kind', building({ kind: 'stadium', lit: false })).points).toBe(0);
  });

  it('makes a lit stadium score at least as high as an ordinary lit building overall', () => {
    const total = (place) =>
      PLACE_FACTORS.reduce(
        (sum, factor) => sum + factor.evaluate(place, conditions(), config).points,
        0,
      );
    fastCheck.assert(
      fastCheck.property(unit, (litGlassArea) => {
        expect(total(building({ kind: 'stadium', litGlassArea }))).toBeGreaterThan(
          total(building({ kind: 'building', litGlassArea })),
        );
      }),
    );
  });
});

describe('height factor (R13)', () => {
  it('grows with height and stops at the configured height', () => {
    const short = evaluate('height', building({ heightMeters: 20 })).points;
    const tall = evaluate('height', building({ heightMeters: 100 })).points;
    const tower = evaluate('height', building({ heightMeters: 600 })).points;
    expect(short).toBeLessThan(tall);
    expect(tower).toBeCloseTo(tall, 9);
  });

  it('stays below what a fully lit glass facade gives, however tall the building', () => {
    const fullGlass = evaluate('litGlass', building({ litGlassArea: 1 })).points;
    const tallest = evaluate('height', building({ heightMeters: 1000 })).points;
    expect(tallest).toBeLessThan(fullGlass);
  });

  it('gives nothing, and no missing report, when height is unknown', () => {
    const output = evaluate('height', building({ heightMeters: undefined }));
    expect(output.points).toBe(0);
    expect(output.missing).toEqual([]);
  });
});

describe('lakeshore factor (R38)', () => {
  const nearLake = building({ lakeDistanceMeters: 300 });

  it('adds points near the lake when the wind is from the west, on a heavy night', () => {
    const output = evaluate('lakeshore', nearLake, conditions());
    expect(output.points).toBeCloseTo(weight('lakeshore'), 9);
    expect(output.reasonKey).toBe('lakeshoreWind');
  });

  it('adds nothing when the wind is not from the west', () => {
    expect(
      evaluate('lakeshore', nearLake, conditions({ weather: everywhere(eastWind) })).points,
    ).toBe(0);
  });

  it('adds nothing beyond the distance limit, with no lake reference, or with no wind data', () => {
    const limit = config.weights.lakeshore.maxDistanceMeters;
    expect(
      evaluate('lakeshore', building({ lakeDistanceMeters: limit + 1 }), conditions()).points,
    ).toBe(0);
    expect(evaluate('lakeshore', building({ lakeDistanceMeters: null }), conditions()).points).toBe(
      0,
    );
    expect(evaluate('lakeshore', nearLake, conditions({ weather: undefined })).points).toBe(0);
  });

  it('adds fewer points on a light-migration night', () => {
    const light = evaluate('lakeshore', nearLake, conditions({ migration: { level: 0 } })).points;
    const heavy = evaluate('lakeshore', nearLake, conditions({ migration: { level: 1 } })).points;
    expect(light).toBeLessThan(heavy);
  });
});

describe('facade compass direction (R21; E15)', () => {
  it('never changes any place factor result', () => {
    fastCheck.assert(
      fastCheck.property(fastCheck.double({ min: 0, max: 360, noNaN: true }), (facadeDirection) => {
        const plain = building({ lakeDistanceMeters: 300, treeNear: true });
        const facing = { ...plain, facadeDirection, compassDirection: facadeDirection };
        for (const factor of PLACE_FACTORS) {
          expect(factor.evaluate(facing, conditions(), config)).toEqual(
            factor.evaluate(plain, conditions(), config),
          );
        }
      }),
    );
  });
});
