/**
 * Small geometry helpers for distances on the ground (R38: distance to the lake shore).
 * Points are { latitude, longitude } in degrees. Pure logic, no map library needed.
 */
import type { Coordinate } from './types.ts';

/** A point on the local flat map, in metres. */
interface Flat {
  x: number;
  y: number;
}

const EARTH_RADIUS_METERS = 6_371_008.8;
const HALF_TURN_DEGREES = 180;
const DEGREES_TO_RADIANS = Math.PI / HALF_TURN_DEGREES;

/** Straight-line distance over the ground between two points, in metres (haversine). */
export function distanceMeters(first: Coordinate, second: Coordinate): number {
  const latitudeDelta = (second.latitude - first.latitude) * DEGREES_TO_RADIANS;
  const longitudeDelta = (second.longitude - first.longitude) * DEGREES_TO_RADIANS;
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(first.latitude * DEGREES_TO_RADIANS) *
      Math.cos(second.latitude * DEGREES_TO_RADIANS) *
      Math.sin(longitudeDelta / 2) ** 2;
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.min(1, Math.sqrt(haversine)));
}

/** Local flat map in metres around an origin: good to well under 1 percent within a few km. */
function toLocalMeters(point: Coordinate, origin: Coordinate): Flat {
  const cosine = Math.cos(origin.latitude * DEGREES_TO_RADIANS);
  return {
    x: (point.longitude - origin.longitude) * DEGREES_TO_RADIANS * EARTH_RADIUS_METERS * cosine,
    y: (point.latitude - origin.latitude) * DEGREES_TO_RADIANS * EARTH_RADIUS_METERS,
  };
}

function distanceToSegment(point: Flat, start: Flat, end: Flat): number {
  const lengthSquared = (end.x - start.x) ** 2 + (end.y - start.y) ** 2;
  if (lengthSquared === 0) {
    return Math.hypot(point.x - start.x, point.y - start.y);
  }
  const along =
    ((point.x - start.x) * (end.x - start.x) + (point.y - start.y) * (end.y - start.y)) /
    lengthSquared;
  const clamped = Math.min(1, Math.max(0, along));
  return Math.hypot(
    point.x - (start.x + clamped * (end.x - start.x)),
    point.y - (start.y + clamped * (end.y - start.y)),
  );
}

/**
 * Shortest distance in metres from a point to a line made of points.
 * @param {{ latitude: number, longitude: number }} point
 * @param {{ latitude: number, longitude: number }[]} line at least one point
 * @returns {number} Infinity for an empty line
 */
export function distanceToLineMeters(point: Coordinate, line: Coordinate[]): number {
  if (line.length === 0) {
    return Number.POSITIVE_INFINITY;
  }
  const flat = line.map((vertex) => toLocalMeters(vertex, point));
  const origin = { x: 0, y: 0 };
  if (flat.length === 1) {
    return Math.hypot(flat[0].x, flat[0].y);
  }
  let shortest = Number.POSITIVE_INFINITY;
  for (let index = 1; index < flat.length; index += 1) {
    shortest = Math.min(shortest, distanceToSegment(origin, flat[index - 1], flat[index]));
  }
  return shortest;
}
