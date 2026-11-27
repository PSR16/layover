/**
 * Geometry helpers for the building extract (spec 2 R1, R2): ring area, centroid, Douglas-Peucker
 * simplification and coordinate rounding. Pure functions, tested in tests/extract-geometry.test.ts.
 * Rings are arrays of [longitude, latitude]. Distances use a local flat map in metres, which is
 * accurate to well under 1 percent over one building.
 */
import type { RingPoint } from '../src/lib/types.ts';
interface Flat {
  x: number;
  y: number;
}
const METERS_PER_DEGREE = 111_320;
const DEGREES_TO_RADIANS = Math.PI / 180;
function toFlat(ring: RingPoint[]): Flat[] {
  const [originLongitude, originLatitude] = ring[0];
  const cosine = Math.cos(originLatitude * DEGREES_TO_RADIANS);
  return ring.map(([longitude, latitude]) => ({
    x: (longitude - originLongitude) * METERS_PER_DEGREE * cosine,
    y: (latitude - originLatitude) * METERS_PER_DEGREE,
  }));
}
/** Area of a ring in square metres (shoelace formula, always positive). */
export function ringAreaSquareMeters(ring: RingPoint[]): number {
  const flat = toFlat(ring);
  let twiceArea = 0;
  for (let index = 0; index < flat.length - 1; index += 1) {
    twiceArea += flat[index].x * flat[index + 1].y - flat[index + 1].x * flat[index].y;
  }
  return Math.abs(twiceArea) / 2;
}
/** The middle of the ring's bounding box. Good enough to place a marker. */
export function ringCenter(ring: RingPoint[]): { latitude: number; longitude: number } {
  const longitudes = ring.map((point) => point[0]);
  const latitudes = ring.map((point) => point[1]);
  return {
    longitude: (Math.min(...longitudes) + Math.max(...longitudes)) / 2,
    latitude: (Math.min(...latitudes) + Math.max(...latitudes)) / 2,
  };
}
function distanceToChord(point: Flat, start: Flat, end: Flat): number {
  const deltaX = end.x - start.x;
  const deltaY = end.y - start.y;
  const length = Math.hypot(deltaX, deltaY);
  if (length === 0) {
    return Math.hypot(point.x - start.x, point.y - start.y);
  }
  return Math.abs(deltaY * (point.x - start.x) - deltaX * (point.y - start.y)) / length;
}
/** The index of the point between `from` and `stop` that is farthest from the chord, with its distance. */
function farthestPoint(
  flat: Flat[],
  from: number,
  stop: number,
): { index: number; distance: number } {
  let best = { index: from, distance: 0 };
  for (let index = from + 1; index < stop; index += 1) {
    const distance = distanceToChord(flat[index], flat[from], flat[stop]);
    if (distance > best.distance) {
      best = { index, distance };
    }
  }
  return best;
}
/** Douglas-Peucker on the open run from `first` to `last`: marks the indices to keep. */
function markKept(
  flat: Flat[],
  [first, last]: [number, number],
  tolerance: number,
  kept: boolean[],
) {
  const pending: [number, number][] = [[first, last]];
  kept[first] = true;
  kept[last] = true;
  while (pending.length > 0) {
    const [from, stop] = pending.pop() as [number, number];
    const { index, distance } = farthestPoint(flat, from, stop);
    if (distance > tolerance) {
      kept[index] = true;
      pending.push([from, index], [index, stop]);
    }
  }
}
function farthestFromStart(flat: Flat[]): number {
  let best = 1;
  for (let index = 2; index < flat.length - 1; index += 1) {
    const far = Math.hypot(flat[index].x, flat[index].y);
    if (far > Math.hypot(flat[best].x, flat[best].y)) {
      best = index;
    }
  }
  return best;
}
/**
 * Fewer points for a closed ring, keeping the shape within `toleranceMeters`. The ring is split at
 * the point farthest from the start so both halves are open runs. A ring that would fall below 4
 * points is returned unchanged, so a small building is never collapsed.
 */
export function simplifyRing(ring: RingPoint[], toleranceMeters: number): RingPoint[] {
  const minimumPoints = 4;
  if (ring.length <= minimumPoints) {
    return ring;
  }
  const flat = toFlat(ring);
  const split = farthestFromStart(flat);
  const kept: boolean[] = ring.map(() => false);
  markKept(flat, [0, split], toleranceMeters, kept);
  markKept(flat, [split, ring.length - 1], toleranceMeters, kept);
  const result = ring.filter((_point, index) => kept[index]);
  return result.length >= minimumPoints ? result : ring;
}
/** Round to a number of decimals. 5 decimals of a degree is about 1 m. */
export function roundTo(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}
export function roundRing(ring: RingPoint[], decimals: number): RingPoint[] {
  return ring.map(([longitude, latitude]) => [
    roundTo(longitude, decimals),
    roundTo(latitude, decimals),
  ]);
}
/** Fewer points for an open line, keeping both ends and the shape within `toleranceMeters`. */
export function simplifyLine(line: RingPoint[], toleranceMeters: number): RingPoint[] {
  const minimumPoints = 3;
  if (line.length <= minimumPoints) {
    return line;
  }
  const kept: boolean[] = line.map(() => false);
  markKept(toFlat(line), [0, line.length - 1], toleranceMeters, kept);
  return line.filter((_point, index) => kept[index]);
}
