/**
 * Wind helpers. Every direction is where the wind comes FROM, in degrees clockwise from north
 * (90 = east wind, 270 = west wind). This is the weather-report and Open-Meteo convention and
 * matches the Chen et al. 2024 wording (E2) and the Van Doren et al. 2021 data (E1).
 */

const FULL_CIRCLE = 360;
const HALF_CIRCLE = 180;

/** Sector for wind from the west, centred on 270 degrees. Width is an assumption (E1, E2). */
const WEST_START = 225;
const WEST_END = 315;
const WEST_SECTOR = [WEST_START, WEST_END];

/** Wrap any angle into the range 0 (inclusive) to 360 (exclusive). */
export function normalizeDegrees(degrees: number): number {
  return ((degrees % FULL_CIRCLE) + FULL_CIRCLE) % FULL_CIRCLE;
}

/** Smallest angle between two directions, 0 to 180. */
export function angleDifference(first: number, second: number): number {
  const difference = Math.abs(normalizeDegrees(first) - normalizeDegrees(second));
  return Math.min(difference, FULL_CIRCLE - difference);
}

/**
 * True when a direction lies inside a sector, including sectors that cross north.
 * A sector is [start, end] and runs clockwise from start to end.
 */
export function isInSector(degrees: number, sector: readonly number[]): boolean {
  const direction = normalizeDegrees(degrees);
  const start = normalizeDegrees(sector[0]);
  const end = normalizeDegrees(sector[1]);
  if (start <= end) {
    return direction >= start && direction <= end;
  }
  return direction >= start || direction <= end;
}

/** True when a direction lies inside any of the sectors. */
export function isInAnySector(degrees: number, sectors: readonly (readonly number[])[]): boolean {
  return sectors.some((sector) => isInSector(degrees, sector));
}

/** True when wind comes from the west (toward the lake side in Chicago). R38. */
export function isWesterly(degrees: number, sector: readonly number[] = WEST_SECTOR): boolean {
  return isInSector(degrees, sector);
}

/**
 * Wind turned unfavorable between the early and late part of the night (R17, E4).
 * "Turned" means: not unfavorable early, unfavorable late.
 */
export function turnedUnfavorable(
  earlyDegrees: number,
  lateDegrees: number,
  unfavorableSectors: readonly (readonly number[])[],
): boolean {
  return (
    !isInAnySector(earlyDegrees, unfavorableSectors) &&
    isInAnySector(lateDegrees, unfavorableSectors)
  );
}

/**
 * Average direction using unit vectors, so 350 and 10 average to 0 and not 180.
 * Returns null for an empty list or when directions cancel out exactly.
 */
export function circularMeanDegrees(directions: number[]): number | null {
  if (directions.length === 0) {
    return null;
  }
  const radians = directions.map((degrees) => (degrees * Math.PI) / HALF_CIRCLE);
  const east = radians.reduce((total, angle) => total + Math.sin(angle), 0);
  const north = radians.reduce((total, angle) => total + Math.cos(angle), 0);
  const tolerance = 1e-9;
  if (Math.abs(east) < tolerance && Math.abs(north) < tolerance) {
    return null;
  }
  return normalizeDegrees((Math.atan2(east, north) * HALF_CIRCLE) / Math.PI);
}

const COMPASS_POINTS = [
  'N',
  'NNE',
  'NE',
  'ENE',
  'E',
  'ESE',
  'SE',
  'SSE',
  'S',
  'SSW',
  'SW',
  'WSW',
  'W',
  'WNW',
  'NW',
  'NNW',
];

/** Compass name of a direction, for example 337 gives 'NNW'. */
export function compassPoint(degrees: number): string {
  const slice = FULL_CIRCLE / COMPASS_POINTS.length;
  return COMPASS_POINTS[
    Math.floor((normalizeDegrees(degrees) + slice / 2) / slice) % COMPASS_POINTS.length
  ];
}
