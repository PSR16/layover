import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import fastCheck from 'fast-check';
import {
  parseDurationHours,
  readingsFromOpenMeteo,
  readingsFromWeatherGov,
  normalizeOpenMeteo,
  normalizeWeatherGov,
} from '../src/lib/weather-normalize.ts';
import { assessNight } from '../src/lib/risk.ts';

const fixture = (name) =>
  JSON.parse(readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8'));
const CHICAGO = { latitude: 41.88, longitude: -87.63 };

const openMeteo = fixture('open-meteo-chicago-2026-10-16.json');
const openMeteoArchive = fixture('open-meteo-archive-no-visibility.json');
const weatherGov = fixture('weather-gov-gridpoint-lot-76-73.json');

describe('parseDurationHours', () => {
  it('reads the duration forms weather.gov uses', () => {
    expect(parseDurationHours('PT1H')).toBe(1);
    expect(parseDurationHours('PT12H')).toBe(12);
    expect(parseDurationHours('P1DT3H')).toBe(27);
    expect(parseDurationHours('P2D')).toBe(48);
  });

  it('rejects anything else', () => {
    for (const text of ['PT30M', '', 'P', 'PT', 'two hours', undefined]) {
      expect(() => parseDurationHours(text)).toThrow(TypeError);
    }
  });
});

describe('readingsFromOpenMeteo', () => {
  it('reads every hour as UTC with metric units', () => {
    const readings = readingsFromOpenMeteo(openMeteo);
    expect(readings).toHaveLength(48);
    expect(readings[0].time.toISOString()).toBe('2026-10-16T00:00:00.000Z');
    expect(readings[0]).toMatchObject({
      windFromDegrees: 141,
      windSpeedMps: 0.71,
      lowCloudPercent: 100,
    });
  });

  it('converts visibility from metres to kilometres', () => {
    expect(readingsFromOpenMeteo(openMeteo)[0].visibilityKm).toBeCloseTo(9.9, 9);
  });

  it('leaves out fields the source gives as null instead of using zero', () => {
    const readings = readingsFromOpenMeteo(openMeteoArchive);
    expect(readings[0]).not.toHaveProperty('visibilityKm');
    expect(readings[0]).toHaveProperty('windSpeedMps');
  });

  it('converts other wind speed units to metres per second', () => {
    const kilometres = structuredClone(openMeteo);
    kilometres.hourly_units.wind_speed_10m = 'km/h';
    kilometres.hourly.wind_speed_10m = [36, ...kilometres.hourly.wind_speed_10m.slice(1)];
    expect(readingsFromOpenMeteo(kilometres)[0].windSpeedMps).toBeCloseTo(10, 9);
    kilometres.hourly_units.wind_speed_10m = 'furlongs';
    expect(() => readingsFromOpenMeteo(kilometres)).toThrow(TypeError);
  });

  it('refuses a response that was not requested in GMT', () => {
    const local = { ...openMeteo, timezone: 'America/Chicago' };
    expect(() => readingsFromOpenMeteo(local)).toThrow(/timezone=GMT/);
    expect(() => readingsFromOpenMeteo({ timezone: 'GMT', hourly: {} })).toThrow(TypeError);
    expect(() => readingsFromOpenMeteo(undefined)).toThrow(TypeError);
  });

  it('treats times that already carry an offset correctly', () => {
    const withOffset = structuredClone(openMeteo);
    withOffset.hourly.time = withOffset.hourly.time.map((time) => `${time}:00Z`);
    expect(readingsFromOpenMeteo(withOffset)[0].time.toISOString()).toBe(
      '2026-10-16T00:00:00.000Z',
    );
  });
});

describe('normalizeOpenMeteo, night of 2026-10-16 (expected values computed separately)', () => {
  const { weather, notes } = normalizeOpenMeteo(openMeteo, '2026-10-16', CHICAGO);

  it('averages the early part: north-northwest wind', () => {
    expect(weather.early.windFromDegrees).toBeCloseTo(343.48, 1);
    expect(weather.early.windSpeedMps).toBeCloseTo(6.145, 2);
    expect(weather.early.lowCloudPercent).toBeCloseTo(29, 1);
    expect(weather.early.visibilityKm).toBeCloseTo(28.675, 2);
  });

  it('averages the middle part', () => {
    expect(weather.middle.windFromDegrees).toBeCloseTo(335.74, 1);
    expect(weather.middle.windSpeedMps).toBeCloseTo(4.41, 2);
    expect(weather.middle.lowCloudPercent).toBeCloseTo(29.75, 1);
  });

  it('averages the late part, with more cloud toward dawn', () => {
    expect(weather.late.windFromDegrees).toBeCloseTo(316.8, 1);
    expect(weather.late.windSpeedMps).toBeCloseTo(4.034, 2);
    expect(weather.late.lowCloudPercent).toBeCloseTo(47.2, 1);
    expect(weather.late.visibilityKm).toBeCloseTo(23.32, 2);
  });

  it('reports no notes when visibility is present', () => {
    expect(notes).toEqual([]);
  });

  it('feeds the risk engine without changing shape', () => {
    const result = assessNight({ night: '2026-10-16', migration: { level: 0.9 }, weather });
    expect(['low', 'elevated', 'high']).toContain(result.level);
    expect(result.missingInputs).toEqual([]);
  });
});

describe('normalizeOpenMeteo without visibility', () => {
  it('still gives wind and cloud and notes the gap', () => {
    const { weather, notes } = normalizeOpenMeteo(openMeteoArchive, '2026-10-16', CHICAGO);
    expect(weather.middle).toHaveProperty('windSpeedMps');
    expect(weather.middle).not.toHaveProperty('visibilityKm');
    expect(notes).toEqual(['visibilityMissing']);
    expect(assessNight({ night: '2026-10-16', weather }).missingInputs).toContain('migration');
  });
});

describe('readingsFromWeatherGov', () => {
  const readings = readingsFromWeatherGov(weatherGov);

  it('spreads each value over the hours it covers, in time order', () => {
    expect(readings[0].time.toISOString()).toBe('2026-11-26T15:00:00.000Z');
    expect(readings[1].time.toISOString()).toBe('2026-11-26T16:00:00.000Z');
    const times = readings.map((reading) => reading.time.getTime());
    expect(times).toEqual([...times].sort((first, second) => first - second));
    expect(readings).toHaveLength(183);
  });

  it('uses the same wind direction for every hour of a multi-hour value', () => {
    expect(readings[0].windFromDegrees).toBe(50);
    expect(readings[1].windFromDegrees).toBe(50);
    expect(readings[2].windFromDegrees).toBe(40);
  });

  it('converts kilometres per hour to metres per second', () => {
    expect(readings[0].windSpeedMps).toBeCloseTo(35.188 / 3.6, 6);
  });

  it('uses sky cover as the cloud value and leaves visibility out when absent', () => {
    expect(readings[0].lowCloudPercent).toBe(97);
    expect(readings[0]).not.toHaveProperty('visibilityKm');
  });

  it('rejects a response with no properties', () => {
    expect(() => readingsFromWeatherGov({})).toThrow(TypeError);
  });
});

describe('normalizeWeatherGov, night of 2026-11-26 (expected values computed separately)', () => {
  const { weather, notes } = normalizeWeatherGov(weatherGov, '2026-11-26', CHICAGO);

  it('averages each part of the night', () => {
    expect(weather.early.windFromDegrees).toBeCloseTo(28, 1);
    expect(weather.early.windSpeedMps).toBeCloseTo(9.774, 2);
    expect(weather.middle.windFromDegrees).toBeCloseTo(18, 1);
    expect(weather.middle.lowCloudPercent).toBeCloseTo(93.4, 1);
    expect(weather.late.windFromDegrees).toBeCloseTo(5, 1);
    expect(weather.late.windSpeedMps).toBeCloseTo(9.389, 2);
  });

  it('notes that low cloud is a total sky cover stand-in and visibility is missing', () => {
    expect(notes).toEqual(['visibilityMissing', 'lowCloudFromSkyCover'].sort());
  });
});

describe('night with no readings', () => {
  it('gives null parts instead of failing', () => {
    const { weather } = normalizeOpenMeteo(openMeteo, '2026-06-01', CHICAGO);
    expect(weather).toEqual({ early: null, middle: null, late: null });
  });

  it('is accepted by the risk engine, which reports the missing weather', () => {
    const { weather } = normalizeOpenMeteo(openMeteo, '2026-06-01', CHICAGO);
    const result = assessNight({ night: '2026-06-01', migration: { level: 0.5 }, weather });
    expect(result.missingInputs).toEqual(expect.arrayContaining(['wind', 'visibility']));
  });
});

function responseFor(list) {
  const json = structuredClone(openMeteo);
  json.hourly.time = list.map(
    (hour, index) => `2026-10-16T${String(index % 24).padStart(2, '0')}:00`,
  );
  json.hourly.wind_speed_10m = list.map((hour) => hour.speed);
  json.hourly.wind_direction_10m = list.map((hour) => hour.direction);
  json.hourly.cloud_cover_low = list.map(() => null);
  json.hourly.visibility = list.map(() => null);
  return json;
}

const speedsOf = (list) => list.map((hour) => hour.speed).filter((speed) => speed !== null);

function expectInsideRange(part, speeds) {
  if (part?.windSpeedMps !== undefined) {
    expect(part.windSpeedMps).toBeGreaterThanOrEqual(Math.min(...speeds) - 1e-9);
    expect(part.windSpeedMps).toBeLessThanOrEqual(Math.max(...speeds) + 1e-9);
  }
  expect(part?.lowCloudPercent).toBeUndefined();
}

describe('normalizer properties', () => {
  const hours = fastCheck.array(
    fastCheck.record({
      speed: fastCheck.option(fastCheck.double({ min: 0, max: 40, noNaN: true }), { nil: null }),
      direction: fastCheck.option(fastCheck.integer({ min: 0, max: 360 }), { nil: null }),
    }),
    { minLength: 1, maxLength: 48 },
  );

  it('never invents values: every averaged field stays inside the input range', () => {
    fastCheck.assert(
      fastCheck.property(hours, (list) => {
        const { weather } = normalizeOpenMeteo(responseFor(list), '2026-10-16', CHICAGO);
        const speeds = speedsOf(list);
        for (const part of Object.values(weather)) {
          expectInsideRange(part, speeds);
        }
      }),
    );
  });
});
