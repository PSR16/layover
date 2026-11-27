import { describe, it, expect } from 'vitest';
import fastCheck from 'fast-check';
import { DEFAULT_CONFIG as config } from '../src/lib/risk-config.ts';
import { validateConfig } from '../src/lib/risk-config-validate.ts';
import { NIGHT_FACTORS, NIGHT_REASON_KEYS } from '../src/lib/risk-night-factors.ts';

const FALL_NIGHT = '2026-10-17';
const SPRING_NIGHT = '2026-04-20';
const OFF_SEASON_NIGHT = '2026-01-10';

const factorById = Object.fromEntries(NIGHT_FACTORS.map((factor) => [factor.id, factor]));
const evaluate = (id, conditions) => factorById[id].evaluate(conditions, config);
const weight = (name) => config.weights[name].weight;

const rough = { windFromDegrees: 200, windSpeedMps: 9, lowCloudPercent: 90, visibilityKm: 3 };
const calm = { windFromDegrees: 10, windSpeedMps: 2, lowCloudPercent: 10, visibilityKm: 12 };
const everywhere = (fields) => ({ early: fields, middle: fields, late: fields });
const night = (overrides = {}) => ({
  night: FALL_NIGHT,
  migration: { level: 0.9 },
  weather: everywhere(rough),
  previousNights: [],
  ...overrides,
});

describe('factor registry', () => {
  it('has config wording for every reason key (validator rule 5)', () => {
    expect(validateConfig(config, { requiredReasonKeys: NIGHT_REASON_KEYS })).toEqual([]);
  });

  it('has a weight in the config for each factor that uses one', () => {
    for (const name of ['migration', 'wind', 'windShift', 'visibility', 'carryOver', 'fallBonus']) {
      expect(config.weights[name].weight).toBeGreaterThan(0);
    }
  });
});

describe('factor output shape (property)', () => {
  const maybe = (arbitrary) => fastCheck.option(arbitrary, { nil: undefined });
  const readingArbitrary = fastCheck.record({
    windFromDegrees: maybe(fastCheck.double({ min: 0, max: 360, noNaN: true })),
    windSpeedMps: maybe(fastCheck.double({ min: 0, max: 30, noNaN: true })),
    lowCloudPercent: maybe(fastCheck.double({ min: 0, max: 100, noNaN: true })),
    visibilityKm: maybe(fastCheck.double({ min: 0, max: 30, noNaN: true })),
  });
  const conditionsArbitrary = fastCheck.record({
    night: fastCheck.constantFrom(FALL_NIGHT, SPRING_NIGHT, OFF_SEASON_NIGHT),
    migration: maybe(
      fastCheck.record({ level: fastCheck.double({ min: 0, max: 1, noNaN: true }) }),
    ),
    weather: maybe(
      fastCheck.record({
        early: readingArbitrary,
        middle: readingArbitrary,
        late: readingArbitrary,
      }),
    ),
    previousNights: maybe(
      fastCheck.array(
        fastCheck.record({
          migration: maybe(
            fastCheck.record({ level: fastCheck.double({ min: 0, max: 1, noNaN: true }) }),
          ),
        }),
        { maxLength: 3 },
      ),
    ),
  });

  it('always returns finite points of 0 or more, a known reason key and a missing list', () => {
    fastCheck.assert(
      fastCheck.property(conditionsArbitrary, (conditions) => {
        for (const factor of NIGHT_FACTORS) {
          const output = factor.evaluate(conditions, config);
          expect(output.id).toBe(factor.id);
          expect(Number.isFinite(output.points)).toBe(true);
          expect(output.points).toBeGreaterThanOrEqual(0);
          expect([null, ...factor.reasonKeys]).toContain(output.reasonKey);
          expect(Array.isArray(output.missing)).toBe(true);
        }
      }),
    );
  });
});

describe('migration factor (R10, R11)', () => {
  it('gives points in proportion to the migration level', () => {
    expect(evaluate('migration', night({ migration: { level: 0.5 } })).points).toBeCloseTo(
      weight('migration') * 0.5,
      9,
    );
  });

  it('never gives fewer points for more migration', () => {
    const level = fastCheck.double({ min: 0, max: 1, noNaN: true });
    fastCheck.assert(
      fastCheck.property(level, level, (first, second) => {
        const low = evaluate('migration', night({ migration: { level: Math.min(first, second) } }));
        const high = evaluate(
          'migration',
          night({ migration: { level: Math.max(first, second) } }),
        );
        expect(high.points).toBeGreaterThanOrEqual(low.points);
      }),
    );
  });

  it('picks the wording from the migration bands', () => {
    expect(evaluate('migration', night({ migration: { level: 0.9 } })).reasonKey).toBe(
      'migrationHeavy',
    );
    expect(evaluate('migration', night({ migration: { level: 0.5 } })).reasonKey).toBe(
      'migrationModerate',
    );
    expect(evaluate('migration', night({ migration: { level: 0.1 } })).reasonKey).toBeNull();
  });

  it('reports missing migration and gives no points (R22)', () => {
    const output = evaluate('migration', night({ migration: undefined }));
    expect(output.points).toBe(0);
    expect(output.missing).toEqual(['migration']);
  });
});

describe('wind factor (R15, R16)', () => {
  it('gives full points for strong unfavorable wind on a full-migration night', () => {
    const output = evaluate('wind', night({ migration: { level: 1 } }));
    expect(output.points).toBeCloseTo(weight('wind'), 9);
    expect(output.reasonKey).toBe('windUnfavorable');
  });

  it('gives fewer points on a light-migration night than on a heavy one', () => {
    const light = evaluate('wind', night({ migration: { level: 0 } })).points;
    const heavy = evaluate('wind', night({ migration: { level: 1 } })).points;
    expect(light).toBeCloseTo(weight('wind') * config.weatherScaling.minimum, 9);
    expect(light).toBeLessThan(heavy);
  });

  it('gives nothing for favorable wind, outside the seasons, or with no wind data', () => {
    expect(evaluate('wind', night({ weather: everywhere(calm) })).points).toBe(0);
    expect(evaluate('wind', night({ night: OFF_SEASON_NIGHT })).points).toBe(0);
    expect(evaluate('wind', night({ weather: undefined })).missing).toEqual(['wind']);
  });

  it('follows the season: a north wind hurts in spring, not in fall', () => {
    const north = everywhere({ ...calm, windSpeedMps: 9 });
    expect(evaluate('wind', night({ weather: north })).points).toBe(0);
    expect(evaluate('wind', night({ night: SPRING_NIGHT, weather: north })).points).toBeGreaterThan(
      0,
    );
  });
});

describe('wind shift factor (R17)', () => {
  const turning = { early: calm, middle: calm, late: { ...calm, windFromDegrees: 220 } };

  it('adds points and a reason when wind turns against migrants before dawn', () => {
    const output = evaluate('windShift', night({ weather: turning, migration: { level: 1 } }));
    expect(output.points).toBeCloseTo(weight('windShift'), 9);
    expect(output.reasonKey).toBe('windShift');
  });

  it('adds nothing when wind does not turn', () => {
    expect(evaluate('windShift', night({ weather: everywhere(rough) })).points).toBe(0);
  });
});

describe('visibility factor (R14, R15)', () => {
  const lowVisibility = everywhere({ ...calm, visibilityKm: 2 });
  const lowCloud = everywhere({ ...calm, lowCloudPercent: 95 });

  it('gives spring low visibility full points even with no migration data', () => {
    const output = evaluate(
      'visibility',
      night({ night: SPRING_NIGHT, migration: undefined, weather: lowVisibility }),
    );
    expect(output.points).toBeCloseTo(weight('visibility'), 9);
    expect(output.reasonKey).toBe('springLowVisibility');
  });

  it('gives spring low visibility full points on a zero-migration night', () => {
    const output = evaluate(
      'visibility',
      night({ night: SPRING_NIGHT, migration: { level: 0 }, weather: lowVisibility }),
    );
    expect(output.points).toBeCloseTo(weight('visibility'), 9);
  });

  it('scales fall low cloud with migration', () => {
    const light = evaluate('visibility', night({ migration: { level: 0 }, weather: lowCloud }));
    const heavy = evaluate('visibility', night({ migration: { level: 1 }, weather: lowCloud }));
    expect(light.points).toBeCloseTo(weight('visibility') * config.weatherScaling.minimum, 9);
    expect(heavy.points).toBeCloseTo(weight('visibility'), 9);
    expect(heavy.reasonKey).toBe('lowCloud');
  });

  it('gives nothing in clear weather and reports missing sky data', () => {
    expect(evaluate('visibility', night({ weather: everywhere(calm) })).points).toBe(0);
    expect(evaluate('visibility', night({ weather: undefined })).missing).toEqual(['visibility']);
  });
});

describe('carry-over factor (R18)', () => {
  const roughHeavyNight = { migration: { level: 0.9 }, weather: everywhere(rough) };
  const quietNight = { migration: { level: 0.1 }, weather: everywhere(rough) };
  const calmHeavyNight = { migration: { level: 0.9 }, weather: everywhere(calm) };

  it('adds a smaller-than-wind contribution after a heavy rough night', () => {
    const output = evaluate('carryOver', night({ previousNights: [roughHeavyNight] }));
    expect(output.points).toBeCloseTo(weight('carryOver'), 9);
    expect(output.points).toBeLessThan(weight('wind'));
    expect(output.reasonKey).toBe('carryOver');
  });

  it('counts either of the last two nights but not an older one', () => {
    expect(
      evaluate('carryOver', night({ previousNights: [quietNight, roughHeavyNight] })).points,
    ).toBeGreaterThan(0);
    expect(
      evaluate('carryOver', night({ previousNights: [quietNight, quietNight, roughHeavyNight] }))
        .points,
    ).toBe(0);
  });

  it('ignores light migration, calm weather and missing history', () => {
    expect(evaluate('carryOver', night({ previousNights: [quietNight] })).points).toBe(0);
    expect(evaluate('carryOver', night({ previousNights: [calmHeavyNight] })).points).toBe(0);
    expect(evaluate('carryOver', night({ previousNights: undefined })).points).toBe(0);
    expect(evaluate('carryOver', night({ previousNights: [{}] })).points).toBe(0);
  });
});

describe('season factor (R19)', () => {
  it('adds the fall bonus in fall and nothing in spring or outside the seasons', () => {
    expect(evaluate('season', night()).points).toBeCloseTo(weight('fallBonus'), 9);
    expect(evaluate('season', night({ night: SPRING_NIGHT })).points).toBe(0);
    expect(evaluate('season', night({ night: OFF_SEASON_NIGHT })).points).toBe(0);
  });

  it('gives fall at least as many points as spring with everything else equal', () => {
    const fall = evaluate('season', night({ night: FALL_NIGHT })).points;
    const spring = evaluate('season', night({ night: SPRING_NIGHT })).points;
    expect(fall).toBeGreaterThanOrEqual(spring);
  });
});
