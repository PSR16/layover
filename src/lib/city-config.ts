/**
 * Checks a city config and turns it into the location the weather code reads (R8, R38).
 * A city has an id, a name, a centre, a time zone, optional risk overrides and an optional
 * lake shoreline (a line of points) used to work out each place's distance to the lake.
 */
import { distanceToLineMeters } from './geo.ts';
import type { City, Coordinate, Location } from './types.ts';

const ID_PATTERN = /^[a-z][a-z0-9-]*$/;
const MAX_LATITUDE = 90;
const MAX_LONGITUDE = 180;

function isCoordinate(point: unknown): point is Coordinate {
  const { latitude, longitude } = (point ?? {}) as Partial<Coordinate>;
  return (
    typeof latitude === 'number' &&
    typeof longitude === 'number' &&
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    Math.abs(latitude) <= MAX_LATITUDE &&
    Math.abs(longitude) <= MAX_LONGITUDE
  );
}

function isTimeZone(name: unknown): boolean {
  if (typeof name !== 'string' || name === '') {
    return false;
  }
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: name });
    return true;
  } catch {
    return false;
  }
}

function checkShoreline(shoreline: Partial<City['shoreline']> | null | undefined): string[] {
  if (shoreline === null || shoreline === undefined) {
    return [];
  }
  const problems: string[] = [];
  if (!['sample', 'map'].includes(shoreline.source ?? '')) {
    problems.push('shoreline.source must be "sample" or "map"');
  }
  if (
    !Array.isArray(shoreline.points) ||
    shoreline.points.length < 2 ||
    !shoreline.points.every(isCoordinate)
  ) {
    problems.push('shoreline.points must list at least 2 coordinates');
  }
  return problems;
}

function checkIdentity(city: Partial<City>): string[] {
  const problems = [];
  if (!ID_PATTERN.test(city.id ?? '')) {
    problems.push('id must be lowercase letters, digits and dashes, starting with a letter');
  }
  if (typeof city.name !== 'string' || city.name.trim() === '') {
    problems.push('name must be a non-empty text');
  }
  return problems;
}

function checkPlace(city: Partial<City>): string[] {
  const problems = [];
  if (!isCoordinate(city.center)) {
    problems.push('center must have a latitude and longitude');
  }
  if (!isTimeZone(city.timeZone)) {
    problems.push('timeZone must be a valid time zone name like America/Chicago');
  }
  return problems;
}

/** Problems with a city config; an empty list means it is usable. */
export function validateCity(city: unknown): string[] {
  if (city === null || typeof city !== 'object') {
    return ['city must be an object'];
  }
  const candidate = city as Partial<City>;
  return [
    ...checkIdentity(candidate),
    ...checkPlace(candidate),
    ...checkShoreline(candidate.shoreline),
  ];
}

/** The location the weather and night code expects: centre plus time zone. */
export function locationOf(city: City): Location {
  return {
    name: city.name,
    latitude: city.center.latitude,
    longitude: city.center.longitude,
    timeZone: city.timeZone,
  };
}

/**
 * Distance in metres from a point to the city's lake shoreline, or null when the city has none
 * (the lakeshore factor then adds nothing, R38).
 */
export function lakeDistanceMeters(city: City, point: Coordinate): number | null {
  if (!city.shoreline) {
    return null;
  }
  return distanceToLineMeters(point, city.shoreline.points);
}
