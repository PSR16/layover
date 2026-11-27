import { describe, it, expect } from 'vitest';
import { CHICAGO, CITIES, DEFAULT_CITY_ID, getCity } from '../src/config/city.js';
import { CHICAGO_RISK_LABEL, CHICAGO_RISK_OVERRIDES } from '../src/config/chicago-risk.js';
import { lakeDistanceMeters, locationOf, validateCity } from '../src/lib/city-config.js';
import { nightOfTonight } from '../src/lib/tonight.js';
import { assessPlace } from '../src/lib/risk.js';

const MCCORMICK_PLACE = { latitude: 41.8514, longitude: -87.6168 };
const WILLIS_TOWER = { latitude: 41.8789, longitude: -87.6359 };
const SOLDIER_FIELD = { latitude: 41.8623, longitude: -87.6167 };
const KELLOGG_HUB = { latitude: 42.0565, longitude: -87.6735 };
const valid = () => structuredClone({ ...CHICAGO, riskOverrides: undefined });
const problemsFor = (change) => {
  const city = valid();
  change(city);
  return validateCity(city);
};

describe('validateCity (R8)', () => {
  it('accepts the Chicago config', () => {
    expect(validateCity(CHICAGO)).toEqual([]);
  });

  it('rejects something that is not an object', () => {
    expect(validateCity(null)).toEqual(['city must be an object']);
    expect(validateCity('chicago')).toEqual(['city must be an object']);
  });

  it('rejects a bad id, name, centre or time zone', () => {
    expect(problemsFor((city) => (city.id = 'Chicago!'))).toHaveLength(1);
    expect(problemsFor((city) => (city.name = '  '))).toHaveLength(1);
    expect(problemsFor((city) => (city.center = { latitude: 91, longitude: 0 }))).toHaveLength(1);
    expect(problemsFor((city) => delete city.center)).toHaveLength(1);
    expect(problemsFor((city) => (city.timeZone = 'Mars/Olympus'))).toHaveLength(1);
    expect(problemsFor((city) => delete city.timeZone)).toHaveLength(1);
  });

  it('allows a city with no shoreline but rejects a broken one (R38)', () => {
    expect(problemsFor((city) => delete city.shoreline)).toEqual([]);
    expect(problemsFor((city) => (city.shoreline = null))).toEqual([]);
    expect(
      problemsFor((city) => (city.shoreline.points = [city.shoreline.points[0]])),
    ).toHaveLength(1);
    expect(problemsFor((city) => (city.shoreline.source = 'guess'))).toHaveLength(1);
  });
});

describe('Chicago city config', () => {
  it('is the default city, and unknown ids fall back to it', () => {
    expect(DEFAULT_CITY_ID).toBe('chicago');
    expect(getCity('chicago')).toBe(CHICAGO);
    expect(getCity('atlantis')).toBe(CHICAGO);
    expect(getCity('__proto__')).toBe(CHICAGO);
    expect(getCity(undefined)).toBe(CHICAGO);
    expect(Object.keys(CITIES)).toEqual(['chicago']);
  });

  it('carries the Chicago risk overlay and its label, and a sample-labelled shoreline', () => {
    expect(CHICAGO.riskOverrides).toBe(CHICAGO_RISK_OVERRIDES);
    expect(CHICAGO.riskLabel).toBe(CHICAGO_RISK_LABEL);
    expect(CHICAGO.shoreline.source).toBe('sample');
    expect(CHICAGO.shoreline.note).toMatch(/sample/i);
  });

  it('lists the shoreline from south to north inside the Chicago area', () => {
    const { points } = CHICAGO.shoreline;
    expect(points.length).toBeGreaterThanOrEqual(8);
    for (const [index, entry] of points.entries()) {
      expect(entry.latitude).toBeGreaterThan(41.6);
      expect(entry.latitude).toBeLessThan(42.15);
      expect(entry.longitude).toBeGreaterThan(-87.8);
      expect(entry.longitude).toBeLessThan(-87.4);
      if (index > 0) {
        expect(entry.latitude).toBeGreaterThan(points[index - 1].latitude);
      }
    }
  });

  it('gives the weather code a location with a time zone that works with nightOfTonight', () => {
    const location = locationOf(CHICAGO);
    expect(location).toEqual({
      name: 'Chicago, Illinois',
      latitude: 41.88,
      longitude: -87.63,
      timeZone: 'America/Chicago',
    });
    expect(nightOfTonight(new Date('2026-11-26T20:00:00Z'), location)).toBe('2026-11-26');
  });
});

describe('lakeDistanceMeters (R38)', () => {
  it('puts the lakefront venues close to the shore and the Loop farther inland (sample shoreline)', () => {
    const mccormick = lakeDistanceMeters(CHICAGO, MCCORMICK_PLACE);
    const soldier = lakeDistanceMeters(CHICAGO, SOLDIER_FIELD);
    const willis = lakeDistanceMeters(CHICAGO, WILLIS_TOWER);
    expect(mccormick).toBeLessThan(1000);
    expect(soldier).toBeLessThan(1000);
    expect(willis).toBeGreaterThan(1500);
    expect(lakeDistanceMeters(CHICAGO, KELLOGG_HUB)).toBeLessThan(800);
  });

  it('gives null for a city with no shoreline, so the lakeshore factor adds nothing', () => {
    const inland = { ...CHICAGO, shoreline: undefined };
    expect(lakeDistanceMeters(inland, MCCORMICK_PLACE)).toBeNull();
    const place = {
      id: 'inland-building',
      kind: 'building',
      lit: true,
      litGlassArea: 0.8,
      lakeDistanceMeters: lakeDistanceMeters(inland, MCCORMICK_PLACE),
    };
    const conditions = {
      night: '2026-10-16',
      migration: { level: 1 },
      weather: {
        early: { windFromDegrees: 270 },
        middle: { windFromDegrees: 270 },
        late: { windFromDegrees: 270 },
      },
    };
    const lake = assessPlace({ ...place, lakeDistanceMeters: 300 }, conditions);
    const dry = assessPlace(place, conditions);
    expect(lake.internal.totalPoints).toBeGreaterThan(dry.internal.totalPoints);
  });
});
