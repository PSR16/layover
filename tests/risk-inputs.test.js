import { describe, it, expect } from 'vitest';
import { DEFAULT_CONFIG as config } from '../src/lib/risk-config.js';
import {
  combineParts,
  migrationLevel,
  weatherScale,
  summarizeWeather,
} from '../src/lib/risk-inputs.js';

const reading = (fields) => ({ windFromDegrees: 200, windSpeedMps: 8, ...fields });
const sameEverywhere = (fields) => ({ early: fields, middle: fields, late: fields });

describe('combineParts', () => {
  it('weights the parts by config (middle counts double)', () => {
    expect(combineParts({ early: 0, middle: 1, late: 0 }, config)).toBeCloseTo(0.5, 9);
  });

  it('renormalizes when a part is missing', () => {
    expect(combineParts({ early: 1, middle: 1 }, config)).toBeCloseTo(1, 9);
    expect(combineParts({ late: 0.4 }, config)).toBeCloseTo(0.4, 9);
  });

  it('gives undefined when no part has a value', () => {
    expect(combineParts({}, config)).toBeUndefined();
    expect(combineParts({ early: undefined, middle: Number.NaN }, config)).toBeUndefined();
  });
});

describe('migrationLevel', () => {
  it('uses a single level for the whole night', () => {
    expect(migrationLevel({ level: 0.7 }, config)).toBeCloseTo(0.7, 9);
  });

  it('weights per-part levels (R37)', () => {
    expect(migrationLevel({ early: 0.2, middle: 1, late: 0.2 }, config)).toBeCloseTo(0.6, 9);
  });

  it('gives undefined when there is no migration data', () => {
    expect(migrationLevel(undefined, config)).toBeUndefined();
    expect(migrationLevel({}, config)).toBeUndefined();
    expect(migrationLevel({ source: 'sample' }, config)).toBeUndefined();
  });
});

describe('weatherScale', () => {
  it('runs from the configured minimum up to 1', () => {
    expect(weatherScale(0, config)).toBeCloseTo(config.weatherScaling.minimum, 9);
    expect(weatherScale(1, config)).toBeCloseTo(1, 9);
  });

  it('clamps out-of-range levels and treats missing migration as full scale', () => {
    expect(weatherScale(5, config)).toBeCloseTo(1, 9);
    expect(weatherScale(-5, config)).toBeCloseTo(config.weatherScaling.minimum, 9);
    expect(weatherScale(undefined, config)).toBe(1);
  });
});

describe('summarizeWeather wind', () => {
  it('scores unfavorable fall wind 1 when strong and the light factor when weaker', () => {
    const strong = summarizeWeather(sameEverywhere(reading({ windSpeedMps: 9 })), 'fall', config);
    const light = summarizeWeather(sameEverywhere(reading({ windSpeedMps: 2 })), 'fall', config);
    expect(strong.wind).toBe(1);
    expect(light.wind).toBe(config.wind.lightWindFactor);
  });

  it('scores favorable wind 0 and uses season-specific sectors', () => {
    const north = sameEverywhere(reading({ windFromDegrees: 10 }));
    expect(summarizeWeather(north, 'fall', config).wind).toBe(0);
    expect(summarizeWeather(north, 'spring', config).wind).toBe(1);
  });

  it('scores 0 outside the seasons and undefined when wind is not measured', () => {
    expect(summarizeWeather(sameEverywhere(reading({})), null, config).wind).toBe(0);
    expect(
      summarizeWeather(sameEverywhere({ visibilityKm: 9 }), 'fall', config).wind,
    ).toBeUndefined();
    expect(summarizeWeather(undefined, 'fall', config).wind).toBeUndefined();
  });

  it('uses one reading for all parts when given a single reading (R37)', () => {
    expect(summarizeWeather(reading({ windSpeedMps: 9 }), 'fall', config).wind).toBe(1);
  });
});

describe('summarizeWeather wind shift', () => {
  const shifting = (early, late) => ({
    early: reading({ windFromDegrees: early }),
    middle: reading({ windFromDegrees: early }),
    late: reading({ windFromDegrees: late }),
  });

  it('is 1 when wind turns from favorable early to unfavorable late (R17)', () => {
    expect(summarizeWeather(shifting(10, 220), 'fall', config).windShift).toBe(1);
  });

  it('is 0 when wind does not turn against migrants', () => {
    expect(summarizeWeather(shifting(200, 220), 'fall', config).windShift).toBe(0);
    expect(summarizeWeather(shifting(220, 10), 'fall', config).windShift).toBe(0);
  });

  it('is undefined without early and late directions or outside the seasons', () => {
    expect(summarizeWeather(reading({}), 'fall', config).windShift).toBe(0);
    expect(summarizeWeather({ middle: reading({}) }, 'fall', config).windShift).toBeUndefined();
    expect(summarizeWeather(shifting(10, 220), null, config).windShift).toBeUndefined();
  });
});

describe('summarizeWeather sky', () => {
  it('flags low visibility and low cloud, and reports the worse of the two', () => {
    const lowVisibility = summarizeWeather(sameEverywhere({ visibilityKm: 2 }), 'spring', config);
    expect(lowVisibility.lowVisibility).toBe(1);
    expect(lowVisibility.lowCloud).toBeUndefined();
    expect(lowVisibility.sky).toBe(1);
    const lowCloud = summarizeWeather(
      sameEverywhere({ visibilityKm: 10, lowCloudPercent: 90 }),
      'fall',
      config,
    );
    expect(lowCloud.lowVisibility).toBe(0);
    expect(lowCloud.lowCloud).toBe(1);
    expect(lowCloud.sky).toBe(1);
  });

  it('is 0 in clear weather and undefined when neither is measured', () => {
    expect(
      summarizeWeather(sameEverywhere({ visibilityKm: 10, lowCloudPercent: 10 }), 'fall', config)
        .sky,
    ).toBe(0);
    expect(summarizeWeather(sameEverywhere({}), 'fall', config).sky).toBeUndefined();
  });
});
