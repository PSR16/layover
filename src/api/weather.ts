/**
 * Weather requests (R27, R28, R29). Network code lives here, never in src/lib.
 *
 * - Replay nights: Open-Meteo historical-forecast API, forecast-model data (not station
 *   observations). If the request fails or times out, or the night cannot be fetched at all
 *   (radar nights from 2000 to 2020), the saved snapshot is used and labelled "Saved weather".
 * - Tonight: weather.gov gridpoint forecast for the city centre. If it fails, the result says
 *   "Weather unavailable" and the engine works from the inputs it has (R22).
 *
 * Every function takes its dependencies (fetch, timeout, clock, cache) so tests need no network.
 * A browser sends its own User-Agent header and ignores one set here.
 */
import { nightOfTonight } from '../lib/tonight.ts';
import type { ByPart, Location, ReplayNight, WeatherReading, WeatherResult } from '../lib/types.ts';
import { normalizeOpenMeteo, normalizeWeatherGov } from '../lib/weather-normalize.ts';

type FetchFunction = (url: string, init: RequestInit) => Promise<Response>;
type FailureReason = 'timeout' | 'network' | 'http' | 'invalid' | 'empty';

/** What a caller may pass in. Everything is optional, so tests can fake the network and the clock. */
export interface WeatherOptions {
  fetchFn?: FetchFunction;
  timeoutMs?: number;
  now?: () => Date;
  cache?: Map<string, string>;
}

interface Settings {
  fetchFn: FetchFunction;
  timeoutMs: number;
  now: () => Date;
  cache: Map<string, string>;
  headers: Record<string, string>;
}

const OPEN_METEO_URL = 'https://historical-forecast-api.open-meteo.com/v1/forecast';
const WEATHER_GOV_POINTS_URL = 'https://api.weather.gov/points';
const MILLISECONDS_PER_DAY = 86_400_000;
const ISO_DATE_LENGTH = 10;
const COORDINATE_DECIMALS = 4;

export const DEFAULT_TIMEOUT_MS = 5000;
export const SAVED_WEATHER_LABEL = 'Saved weather';
export const UNAVAILABLE_WEATHER_LABEL = 'Weather unavailable';

const pointsCache = new Map<string, string>();

export class WeatherRequestError extends Error {
  reason: FailureReason;
  status: number | undefined;

  constructor(reason: FailureReason, details: { status?: number } = {}) {
    super(`Weather request failed: ${reason}`);
    this.name = 'WeatherRequestError';
    this.reason = reason;
    this.status = details.status;
  }
}

function dayAfter(isoDate: string): string {
  const next = Date.parse(`${isoDate}T00:00:00Z`) + MILLISECONDS_PER_DAY;
  return new Date(next).toISOString().slice(0, ISO_DATE_LENGTH);
}

/** Open-Meteo request for the night starting on `night` (hourly values in GMT, speeds in m/s). */
export function openMeteoUrl(
  night: string,
  location: Pick<Location, 'latitude' | 'longitude'>,
): string {
  const query = new URLSearchParams({
    latitude: String(location.latitude),
    longitude: String(location.longitude),
    start_date: night,
    end_date: dayAfter(night),
    hourly: 'wind_speed_10m,wind_direction_10m,cloud_cover_low,visibility',
    wind_speed_unit: 'ms',
    timezone: 'GMT',
  });
  return `${OPEN_METEO_URL}?${query}`;
}

function failureReason(error: unknown): FailureReason {
  return (error as { name?: string } | null)?.name === 'AbortError' ? 'timeout' : 'network';
}

async function readJson(response: Response): Promise<unknown> {
  if (!response.ok) {
    throw new WeatherRequestError('http', { status: response.status });
  }
  try {
    return await response.json();
  } catch {
    throw new WeatherRequestError('invalid');
  }
}

/** GET a URL as JSON, giving up after `timeoutMs`. Throws WeatherRequestError. */
async function fetchJson(url: string, { fetchFn, timeoutMs, headers }: Settings): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchFn(url, { headers, signal: controller.signal });
    return await readJson(response);
  } catch (error) {
    throw error instanceof WeatherRequestError
      ? error
      : new WeatherRequestError(failureReason(error));
  } finally {
    clearTimeout(timer);
  }
}

function withDefaults(options: WeatherOptions = {}): Settings {
  return {
    fetchFn: options.fetchFn ?? globalThis.fetch.bind(globalThis),
    timeoutMs: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    now: options.now ?? (() => new Date()),
    cache: options.cache ?? pointsCache,
    headers: { Accept: 'application/geo+json' },
  };
}

function requireSomeWeather(weather: ByPart<WeatherReading>): void {
  const hasPart = Object.values(weather).some((part) => part !== null);
  if (!hasPart) {
    throw new WeatherRequestError('empty');
  }
}

/**
 * Historical weather for one night from Open-Meteo, averaged into night parts.
 * @returns {Promise<{ weather: object, notes: string[] }>}
 */
export async function fetchHistoricalWeather(
  night: string,
  location: Location,
  options?: WeatherOptions,
): Promise<{ weather: ByPart<WeatherReading>; notes: string[] }> {
  const settings = withDefaults(options);
  const json = await fetchJson(openMeteoUrl(night, location), settings);
  let result: ReturnType<typeof normalizeOpenMeteo>;
  try {
    result = normalizeOpenMeteo(json, night, location);
  } catch {
    throw new WeatherRequestError('invalid');
  }
  requireSomeWeather(result.weather);
  return result;
}

async function gridpointUrl(location: Location, settings: Settings): Promise<string> {
  const key = `${location.latitude.toFixed(COORDINATE_DECIMALS)},${location.longitude.toFixed(COORDINATE_DECIMALS)}`;
  if (!settings.cache.has(key)) {
    const points = (await fetchJson(`${WEATHER_GOV_POINTS_URL}/${key}`, settings)) as {
      properties?: { forecastGridData?: unknown };
    } | null;
    const url = points?.properties?.forecastGridData;
    if (typeof url !== 'string') {
      throw new WeatherRequestError('invalid');
    }
    settings.cache.set(key, url);
  }
  return settings.cache.get(key) as string;
}

/**
 * Forecast for tonight from weather.gov, averaged into night parts.
 * @returns {Promise<{ night: string, weather: object, notes: string[] }>}
 */
export async function fetchTonightWeather(
  location: Location,
  options?: WeatherOptions,
): Promise<{ night: string; weather: ByPart<WeatherReading>; notes: string[] }> {
  const settings = withDefaults(options);
  const night = nightOfTonight(settings.now(), location);
  const json = await fetchJson(await gridpointUrl(location, settings), settings);
  let result: ReturnType<typeof normalizeWeatherGov>;
  try {
    result = normalizeWeatherGov(json, night, location);
  } catch {
    throw new WeatherRequestError('invalid');
  }
  requireSomeWeather(result.weather);
  return { night, ...result };
}

function errorSummary(error: unknown): { reason: string; status?: number } {
  const reason = error instanceof WeatherRequestError ? error.reason : 'network';
  const status = error instanceof WeatherRequestError ? error.status : undefined;
  return status === undefined ? { reason } : { reason, status };
}

function savedResult(record: ReplayNight, error?: unknown): WeatherResult {
  return {
    weather: record.weather,
    notes: [],
    source: 'saved',
    label: SAVED_WEATHER_LABEL,
    provider: record.weatherSource,
    savedOn: record.weatherSavedOn,
    ...(error ? { error: errorSummary(error) } : {}),
  };
}

/**
 * Weather for a replay night (R27, R28). Nights marked `liveWeather` are requested from
 * Open-Meteo; any failure, timeout or empty answer falls back to the saved snapshot. Other
 * nights use the saved snapshot directly.
 */
export async function loadReplayWeather(
  record: ReplayNight,
  location: Location,
  options?: WeatherOptions,
): Promise<WeatherResult> {
  if (!record.liveWeather) {
    return savedResult(record);
  }
  try {
    const { weather, notes } = await fetchHistoricalWeather(record.night, location, options);
    return {
      weather,
      notes,
      source: 'live',
      label: 'Weather from Open-Meteo',
      provider: 'Open-Meteo',
    };
  } catch (error) {
    return savedResult(record, error);
  }
}

/** Weather for tonight (R29). On failure the weather is left out and the label says so. */
export async function loadTonightWeather(
  location: Location,
  options?: WeatherOptions,
): Promise<WeatherResult> {
  const settings = withDefaults(options);
  try {
    const { night, weather, notes } = await fetchTonightWeather(location, settings);
    return {
      night,
      weather,
      notes,
      source: 'live',
      label: 'Weather from weather.gov',
      provider: 'weather.gov',
    };
  } catch (error) {
    return {
      night: nightOfTonight(settings.now(), location),
      weather: undefined,
      notes: [],
      source: 'unavailable',
      label: UNAVAILABLE_WEATHER_LABEL,
      provider: null,
      error: errorSummary(error),
    };
  }
}
