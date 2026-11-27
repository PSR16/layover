import { describe, it, expect } from 'vitest';
import fastCheck from 'fast-check';
import {
  DEFAULT_TIMEOUT_MS,
  SAVED_WEATHER_LABEL,
  WeatherRequestError,
  fetchHistoricalWeather,
  loadReplayWeather,
  openMeteoUrl,
} from '../src/api/weather.js';
import { REPLAY_NIGHTS, findReplayNight } from '../src/data/replay-nights.js';
import { conditionsFromReplay } from '../src/lib/replay-conditions.js';
import { normalizeOpenMeteo } from '../src/lib/weather-normalize.js';
import { assessNight } from '../src/lib/risk.js';
import { CHICAGO, failureOf, fixture, hang, recorder, reply } from './helpers/fake-fetch.js';

const openMeteoJson = fixture('open-meteo-chicago-2026-10-16.json');

describe('openMeteoUrl', () => {
  it('asks for the night in GMT with the four variables and speeds in m/s', () => {
    const url = new URL(openMeteoUrl('2026-10-16', CHICAGO));
    expect(url.origin + url.pathname).toBe(
      'https://historical-forecast-api.open-meteo.com/v1/forecast',
    );
    expect(url.searchParams.get('start_date')).toBe('2026-10-16');
    expect(url.searchParams.get('end_date')).toBe('2026-10-17');
    expect(url.searchParams.get('timezone')).toBe('GMT');
    expect(url.searchParams.get('wind_speed_unit')).toBe('ms');
    expect(url.searchParams.get('hourly')).toBe(
      'wind_speed_10m,wind_direction_10m,cloud_cover_low,visibility',
    );
    expect(url.searchParams.get('latitude')).toBe('41.88');
  });

  it('rolls the end date over month and year ends', () => {
    expect(new URL(openMeteoUrl('2026-12-31', CHICAGO)).searchParams.get('end_date')).toBe(
      '2027-01-01',
    );
  });
});

describe('fetchHistoricalWeather', () => {
  it('returns the same night parts as normalizing the response directly', async () => {
    const { fetchFn, calls } = recorder(() => reply(openMeteoJson));
    const result = await fetchHistoricalWeather('2026-10-16', CHICAGO, { fetchFn });
    expect(result).toEqual(normalizeOpenMeteo(openMeteoJson, '2026-10-16', CHICAGO));
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe(openMeteoUrl('2026-10-16', CHICAGO));
  });

  it('uses a 5 second timeout by default', () => {
    expect(DEFAULT_TIMEOUT_MS).toBe(5000);
  });

  it('reports an HTTP error with its status', async () => {
    const { fetchFn } = recorder(() => reply({}, 503));
    const error = await failureOf(fetchHistoricalWeather('2026-10-16', CHICAGO, { fetchFn }));
    expect(error).toBeInstanceOf(WeatherRequestError);
    expect(error).toMatchObject({ reason: 'http', status: 503 });
  });

  it('reports a network failure', async () => {
    const { fetchFn } = recorder(() => {
      throw new TypeError('Failed to fetch');
    });
    const error = await failureOf(fetchHistoricalWeather('2026-10-16', CHICAGO, { fetchFn }));
    expect(error.reason).toBe('network');
  });

  it('gives up after the timeout', async () => {
    const { fetchFn } = recorder(hang);
    const started = Date.now();
    const error = await failureOf(
      fetchHistoricalWeather('2026-10-16', CHICAGO, { fetchFn, timeoutMs: 25 }),
    );
    expect(error.reason).toBe('timeout');
    expect(Date.now() - started).toBeLessThan(2000);
  });

  it('reports text that is not JSON, and JSON of the wrong shape', async () => {
    const notJson = recorder(() => new Response('<html>oops</html>', { status: 200 }));
    expect((await failureOf(fetchHistoricalWeather('2026-10-16', CHICAGO, notJson))).reason).toBe(
      'invalid',
    );
    const wrongShape = recorder(() => reply({ hello: 'world' }));
    expect(
      (await failureOf(fetchHistoricalWeather('2026-10-16', CHICAGO, wrongShape))).reason,
    ).toBe('invalid');
  });

  it('reports an answer that has no weather for the night', async () => {
    const { fetchFn } = recorder(() => reply(openMeteoJson));
    const error = await failureOf(fetchHistoricalWeather('2026-06-01', CHICAGO, { fetchFn }));
    expect(error.reason).toBe('empty');
  });
});

describe('loadReplayWeather (R27, R28)', () => {
  const news = findReplayNight('news-2026-10-16');
  const radar = findReplayNight('radar-2018-05-01');

  it('uses live weather for a news night when the request works', async () => {
    const { fetchFn } = recorder(() => reply(openMeteoJson));
    const result = await loadReplayWeather(news, CHICAGO, { fetchFn });
    expect(result.source).toBe('live');
    expect(result.label).toBe('Weather from Open-Meteo');
    expect(result.error).toBeUndefined();
    expect(result.weather.middle.windSpeedMps).toBeCloseTo(4.41, 2);
  });

  it('falls back to the saved snapshot, labelled "Saved weather", on an HTTP error', async () => {
    const { fetchFn } = recorder(() => reply({}, 500));
    const result = await loadReplayWeather(news, CHICAGO, { fetchFn });
    expect(result.source).toBe('saved');
    expect(result.label).toBe(SAVED_WEATHER_LABEL);
    expect(result.weather).toEqual(news.weather);
    expect(result.savedOn).toBe(news.weatherSavedOn);
    expect(result.provider).toBe(news.weatherSource);
    expect(result.error).toEqual({ reason: 'http', status: 500 });
  });

  it('falls back on a timeout and on a network failure', async () => {
    const slow = await loadReplayWeather(news, CHICAGO, {
      fetchFn: recorder(hang).fetchFn,
      timeoutMs: 20,
    });
    expect(slow).toMatchObject({ source: 'saved', error: { reason: 'timeout' } });
    const offline = recorder(() => {
      throw new TypeError('offline');
    });
    const result = await loadReplayWeather(news, CHICAGO, { fetchFn: offline.fetchFn });
    expect(result).toMatchObject({ source: 'saved', error: { reason: 'network' } });
  });

  it('uses the saved weather directly for a radar night, with no request', async () => {
    const { fetchFn, calls } = recorder(() => reply(openMeteoJson));
    const result = await loadReplayWeather(radar, CHICAGO, { fetchFn });
    expect(calls).toHaveLength(0);
    expect(result).toMatchObject({ source: 'saved', label: SAVED_WEATHER_LABEL });
    expect(result.error).toBeUndefined();
  });

  it('still gives the risk engine usable weather after a failure', async () => {
    const { fetchFn } = recorder(() => reply({}, 500));
    const result = await loadReplayWeather(news, CHICAGO, { fetchFn });
    const conditions = { ...conditionsFromReplay(news), weather: result.weather };
    const risk = assessNight(conditions);
    expect(['low', 'elevated', 'high']).toContain(risk.level);
    expect(risk.missingInputs).toEqual([]);
  });

  it('never throws and always returns weather, whatever goes wrong (property)', async () => {
    const failure = fastCheck.oneof(
      fastCheck.integer({ min: 400, max: 599 }).map((status) => () => reply({}, status)),
      fastCheck.constant(() => {
        throw new TypeError('network down');
      }),
      fastCheck.constant(() => new Response('not json', { status: 200 })),
      fastCheck.constant(() => reply({ hourly: { time: 'nope' }, timezone: 'GMT' })),
    );
    await fastCheck.assert(
      fastCheck.asyncProperty(
        fastCheck.constantFrom(...REPLAY_NIGHTS),
        failure,
        async (record, handler) => {
          const result = await loadReplayWeather(record, CHICAGO, {
            fetchFn: recorder(handler).fetchFn,
          });
          expect(result.weather).toEqual(record.weather);
          expect(result.label).toBe(SAVED_WEATHER_LABEL);
        },
      ),
    );
  });
});
