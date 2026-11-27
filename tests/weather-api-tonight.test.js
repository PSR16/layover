import { describe, it, expect } from 'vitest';
import {
  UNAVAILABLE_WEATHER_LABEL,
  fetchTonightWeather,
  loadTonightWeather,
} from '../src/api/weather.js';
import { assessNight } from '../src/lib/risk.js';
import { CHICAGO, fixture, hang, recorder, reply } from './helpers/fake-fetch.js';

const pointsJson = fixture('weather-gov-points-chicago.json');
const gridJson = fixture('weather-gov-gridpoint-lot-76-73.json');
const NOW = () => new Date('2026-11-26T20:00:00Z');

const weatherGov = (url) => (url.includes('/points/') ? reply(pointsJson) : reply(gridJson));

describe('fetchTonightWeather and loadTonightWeather (R29)', () => {
  it('looks up the grid first, then the forecast, and names tonight', async () => {
    const { fetchFn, calls } = recorder(weatherGov);
    const result = await fetchTonightWeather(CHICAGO, { fetchFn, now: NOW, cache: new Map() });
    expect(calls.map((call) => call.url)).toEqual([
      'https://api.weather.gov/points/41.8800,-87.6300',
      'https://api.weather.gov/gridpoints/LOT/76,73',
    ]);
    expect(result.night).toBe('2026-11-26');
    expect(result.weather.middle.windSpeedMps).toBeCloseTo(9.98, 2);
    expect(result.notes).toContain('lowCloudFromSkyCover');
  });

  it('asks for geo+json and remembers the grid address', async () => {
    const cache = new Map();
    const { fetchFn, calls } = recorder(weatherGov);
    await fetchTonightWeather(CHICAGO, { fetchFn, now: NOW, cache });
    await fetchTonightWeather(CHICAGO, { fetchFn, now: NOW, cache });
    expect(calls).toHaveLength(3);
    expect(calls[0].init.headers.Accept).toBe('application/geo+json');
  });

  it('labels live results and reports the source', async () => {
    const { fetchFn } = recorder(weatherGov);
    const result = await loadTonightWeather(CHICAGO, { fetchFn, now: NOW, cache: new Map() });
    expect(result).toMatchObject({
      source: 'live',
      label: 'Weather from weather.gov',
      night: '2026-11-26',
    });
  });

  it('says "Weather unavailable" and leaves weather out when the lookup fails', async () => {
    const { fetchFn } = recorder(() => reply({}, 404));
    const result = await loadTonightWeather(CHICAGO, { fetchFn, now: NOW, cache: new Map() });
    expect(result).toMatchObject({
      source: 'unavailable',
      label: UNAVAILABLE_WEATHER_LABEL,
      weather: undefined,
      night: '2026-11-26',
      error: { reason: 'http', status: 404 },
    });
  });

  it('also falls back when the forecast request times out or the points answer is odd', async () => {
    const hangAtForecast = recorder((url, init) =>
      url.includes('/points/') ? reply(pointsJson) : hang(url, init),
    );
    const timedOut = await loadTonightWeather(CHICAGO, {
      fetchFn: hangAtForecast.fetchFn,
      now: NOW,
      cache: new Map(),
      timeoutMs: 20,
    });
    expect(timedOut.error.reason).toBe('timeout');
    const odd = recorder(() => reply({ properties: {} }));
    const result = await loadTonightWeather(CHICAGO, {
      fetchFn: odd.fetchFn,
      now: NOW,
      cache: new Map(),
    });
    expect(result.error.reason).toBe('invalid');
  });

  it('still lets the engine rate the night, naming the missing weather (R22)', async () => {
    const { fetchFn } = recorder(() => reply({}, 500));
    const result = await loadTonightWeather(CHICAGO, { fetchFn, now: NOW, cache: new Map() });
    const risk = assessNight({
      night: result.night,
      migration: { level: 0.5 },
      weather: result.weather,
    });
    expect(risk.missingInputs).toEqual(expect.arrayContaining(['wind', 'visibility']));
  });
});
