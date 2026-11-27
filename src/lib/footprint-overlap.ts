/**
 * Estimates how much two building footprints overlap (spec 2 R32, design risk 6). This is a
 * heuristic: the smaller footprint is sampled on a fixed grid and the share of its own points that
 * also fall inside the other footprint is returned. The grid is fixed, so the answer is repeatable.
 * Pure logic, no DOM or network.
 */
import type { RingPoint } from './types.ts';
const GRID_STEPS = 16;
const CELL_CENTER = 0.5;
interface Box {
  west: number;
  east: number;
  south: number;
  north: number;
}
export function boundingBox(ring: RingPoint[]): Box {
  const longitudes = ring.map((point) => point[0]);
  const latitudes = ring.map((point) => point[1]);
  return {
    west: Math.min(...longitudes),
    east: Math.max(...longitudes),
    south: Math.min(...latitudes),
    north: Math.max(...latitudes),
  };
}
export function boxesTouch(first: Box, second: Box): boolean {
  return (
    first.west < second.east &&
    second.west < first.east &&
    first.south < second.north &&
    second.south < first.north
  );
}
function crossesRay(point: RingPoint, start: RingPoint, end: RingPoint): boolean {
  const [pointX, pointY] = point;
  if (start[1] > pointY === end[1] > pointY) {
    return false;
  }
  const crossingX = ((end[0] - start[0]) * (pointY - start[1])) / (end[1] - start[1]) + start[0];
  return pointX < crossingX;
}
function isInside(point: RingPoint, ring: RingPoint[]): boolean {
  let inside = false;
  for (let index = 1; index < ring.length; index += 1) {
    if (crossesRay(point, ring[index - 1], ring[index])) {
      inside = !inside;
    }
  }
  return inside;
}
function gridPoints(box: Box): RingPoint[] {
  const points: RingPoint[] = [];
  for (let row = 0; row < GRID_STEPS; row += 1) {
    for (let column = 0; column < GRID_STEPS; column += 1) {
      points.push([
        box.west + ((column + CELL_CENTER) / GRID_STEPS) * (box.east - box.west),
        box.south + ((row + CELL_CENTER) / GRID_STEPS) * (box.north - box.south),
      ]);
    }
  }
  return points;
}
function boxArea(box: Box): number {
  return (box.east - box.west) * (box.north - box.south);
}
/**
 * Share (0 to 1) of the smaller footprint that lies inside the larger one. Footprints that only
 * share an edge give 0. Degenerate footprints with no area give 0.
 */
export function overlapOfSmaller(first: RingPoint[], second: RingPoint[]): number {
  const firstBox = boundingBox(first);
  const secondBox = boundingBox(second);
  if (!boxesTouch(firstBox, secondBox)) {
    return 0;
  }
  const firstSmaller = boxArea(firstBox) <= boxArea(secondBox);
  const [small, large, smallBox] = firstSmaller
    ? [first, second, firstBox]
    : [second, first, secondBox];
  const inSmall = gridPoints(smallBox).filter((point) => isInside(point, small));
  if (inSmall.length === 0) {
    return 0;
  }
  return inSmall.filter((point) => isInside(point, large)).length / inSmall.length;
}
