/**
 * Turn weather API responses into the readings the risk engine reads (R27, R29).
 * Pure functions: the fetch code lives in src/api. Directions are where the wind comes FROM.
 *
 * A reading is { time: Date, windFromDegrees, windSpeedMps, lowCloudPercent, visibilityKm }.
 * Any field the source does not give is left out, never filled with 0.
 */
import { getNightTimes } from './night-times.js';
import { summarizeNight } from './night-parts.js';

const MILLISECONDS_PER_HOUR = 3_600_000;
const METERS_PER_KILOMETER = 1000;
const KILOMETERS_PER_HOUR_PER_MPS = 3.6;
const KILOMETERS_PER_HOUR_TO_MPS = 1 / KILOMETERS_PER_HOUR_PER_MPS;
const MILES_PER_HOUR_TO_MPS = 0.447_04;
const KNOTS_TO_MPS = 0.514_444;
// Unit names are the ones Open-Meteo reports in hourly_units.
const SPEED_TO_MPS = new Map([
  ['m/s', 1],
  ['km/h', KILOMETERS_PER_HOUR_TO_MPS],
  ['mp/h', MILES_PER_HOUR_TO_MPS],
  ['kn', KNOTS_TO_MPS],
]);
const HOURS_PER_DAY = 24;
const GMT_NAMES = new Set(['GMT', 'UTC']);
const DURATION_PATTERN = /^P(?:(\d+)D)?(?:T(?:(\d+)H)?)?$/;

function numberOrUndefined(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function scaled(value, factor) {
  const number = numberOrUndefined(value);
  return number === undefined ? undefined : number * factor;
}

function withoutUndefined(reading) {
  return Object.fromEntries(Object.entries(reading).filter(([, value]) => value !== undefined));
}

/** Hours in an ISO 8601 duration like PT2H or P1DT3H (the forms weather.gov uses). */
export function parseDurationHours(text) {
  const match = DURATION_PATTERN.exec(String(text));
  if (!match || (match[1] === undefined && match[2] === undefined)) {
    throw new TypeError(`Unsupported duration: ${String(text)}`);
  }
  return Number(match[1] ?? 0) * HOURS_PER_DAY + Number(match[2] ?? 0);
}

function speedFactor(unit) {
  if (!SPEED_TO_MPS.has(unit)) {
    throw new TypeError(`Unsupported wind speed unit: ${String(unit)}`);
  }
  return SPEED_TO_MPS.get(unit);
}

function checkOpenMeteoShape(json) {
  if (!GMT_NAMES.has(json?.timezone)) {
    throw new TypeError('Open-Meteo response must be requested with timezone=GMT');
  }
  if (!Array.isArray(json.hourly?.time)) {
    throw new TypeError('Open-Meteo response has no hourly.time list');
  }
}

/** Open-Meteo gives times without an offset. With timezone=GMT they are UTC. */
function openMeteoTime(text) {
  return new Date(/(?:Z|[+-]\d\d:\d\d)$/i.test(text) ? text : `${text}Z`);
}

/**
 * Readings from an Open-Meteo hourly response requested with timezone=GMT and the variables
 * wind_speed_10m, wind_direction_10m, cloud_cover_low and visibility.
 */
export function readingsFromOpenMeteo(json) {
  checkOpenMeteoShape(json);
  const { hourly, hourly_units: units = {} } = json;
  const toMps = speedFactor(units.wind_speed_10m ?? 'm/s');
  return hourly.time.map((time, index) =>
    withoutUndefined({
      time: openMeteoTime(time),
      windFromDegrees: numberOrUndefined(hourly.wind_direction_10m?.[index]),
      windSpeedMps: scaled(hourly.wind_speed_10m?.[index], toMps),
      lowCloudPercent: numberOrUndefined(hourly.cloud_cover_low?.[index]),
      visibilityKm: scaled(hourly.visibility?.[index], 1 / METERS_PER_KILOMETER),
    }),
  );
}

/** Spread one weather.gov series over the hours each value covers. */
function expandSeries(series, field, convert) {
  const hours = new Map();
  for (const item of series?.values ?? []) {
    const [start, duration] = item.validTime.split('/');
    const first = new Date(start).getTime();
    const value = convert(item.value);
    const hourCount = parseDurationHours(duration);
    for (let hour = 0; hour < hourCount; hour += 1) {
      hours.set(first + hour * MILLISECONDS_PER_HOUR, { [field]: value });
    }
  }
  return hours;
}

function mergeSeries(seriesMaps) {
  const merged = new Map();
  for (const hours of seriesMaps) {
    for (const [time, fields] of hours) {
      merged.set(time, { ...merged.get(time), ...fields });
    }
  }
  return merged;
}

/**
 * Readings from a weather.gov gridpoint response (api.weather.gov/gridpoints/WFO/x,y).
 * Sky cover is TOTAL cloud cover, used as a cautious stand-in for low cloud because the
 * forecast has no low-cloud layer (research rule 10). Visibility is used when present.
 */
export function readingsFromWeatherGov(json) {
  const properties = json?.properties;
  if (!properties) {
    throw new TypeError('weather.gov response has no properties');
  }
  const merged = mergeSeries([
    expandSeries(properties.windDirection, 'windFromDegrees', numberOrUndefined),
    expandSeries(properties.windSpeed, 'windSpeedMps', (value) =>
      scaled(value, KILOMETERS_PER_HOUR_TO_MPS),
    ),
    expandSeries(properties.skyCover, 'lowCloudPercent', numberOrUndefined),
    expandSeries(properties.visibility, 'visibilityKm', (value) =>
      scaled(value, 1 / METERS_PER_KILOMETER),
    ),
  ]);
  return [...merged.entries()]
    .sort(([first], [second]) => first - second)
    .map(([time, fields]) => withoutUndefined({ time: new Date(time), ...fields }));
}

/**
 * Average readings into the early, middle and late part of one night.
 * @param {string} isoDate night-of date, 'YYYY-MM-DD'
 * @returns {{ early: object | null, middle: object | null, late: object | null }}
 */
export function weatherForNight(readings, isoDate, location) {
  const { sunset, sunrise } = getNightTimes(isoDate, location.latitude, location.longitude);
  return summarizeNight(readings, sunset, sunrise);
}

function notesFor(readings, extra = []) {
  const has = (field) => readings.some((reading) => field in reading);
  return [...extra, ...(has('visibilityKm') ? [] : ['visibilityMissing'])];
}

/** Open-Meteo response to engine weather plus notes about what the source could not give. */
export function normalizeOpenMeteo(json, isoDate, location) {
  const readings = readingsFromOpenMeteo(json);
  return { weather: weatherForNight(readings, isoDate, location), notes: notesFor(readings) };
}

/** weather.gov response to engine weather. Low cloud is a total-cover stand-in (see above). */
export function normalizeWeatherGov(json, isoDate, location) {
  const readings = readingsFromWeatherGov(json);
  const proxy = readings.some((reading) => 'lowCloudPercent' in reading)
    ? ['lowCloudFromSkyCover']
    : [];
  return {
    weather: weatherForNight(readings, isoDate, location),
    notes: notesFor(readings, proxy),
  };
}
