import { describe, it, expect } from 'vitest';
import { distanceToLineMeters } from '../src/lib/geo.ts';
import { simplifyLine } from '../tools/extract-geometry.ts';
import { longestChain, simplifyToMaxPoints, toCoordinates } from '../tools/shoreline-core.ts';
const way = (id, points) => ({ id, geometry: points.map(([lon, lat]) => ({ lat, lon })) });
describe('longestChain', () => {
  it('joins ways end to end, turning around a way that is stored backwards', () => {
    const chain = longestChain([
      way(2, [
        [-87.6, 41.9],
        [-87.61, 41.89],
      ]),
      way(1, [
        [-87.59, 41.91],
        [-87.6, 41.9],
      ]),
      way(3, [
        [-87.62, 41.88],
        [-87.61, 41.89],
      ]),
    ]);
    expect(chain).toEqual([
      [-87.62, 41.88],
      [-87.61, 41.89],
      [-87.6, 41.9],
      [-87.59, 41.91],
    ]);
  });
  it('chooses the longest piece and ignores closed ways', () => {
    const closed = way(9, [
      [0, 0],
      [0, 1],
      [1, 1],
      [0, 0],
    ]);
    const short = way(5, [
      [-87.5, 41.5],
      [-87.5, 41.51],
    ]);
    const long = way(6, [
      [-87.6, 41.6],
      [-87.6, 41.9],
    ]);
    expect(longestChain([closed, short, long])).toEqual([
      [-87.6, 41.6],
      [-87.6, 41.9],
    ]);
  });
  it('gives null when nothing chains (a Y-junction is not a single line)', () => {
    const hub = [-87.6, 41.8];
    const arms = [
      way(1, [hub, [-87.6, 41.9]]),
      way(2, [hub, [-87.5, 41.8]]),
      way(3, [hub, [-87.7, 41.8]]),
    ];
    expect(longestChain(arms)).toBeNull();
    expect(longestChain([])).toBeNull();
  });
});
describe('direction', () => {
  it('starts at the southern end however the ways are stored', () => {
    const north = way(1, [
      [-87.6, 41.9],
      [-87.6, 41.8],
    ]);
    const south = way(1, [
      [-87.6, 41.8],
      [-87.6, 41.9],
    ]);
    expect(longestChain([north])[0][1]).toBeCloseTo(41.8, 8);
    expect(longestChain([south])[0][1]).toBeCloseTo(41.8, 8);
  });
});
describe('simplifyLine and simplifyToMaxPoints', () => {
  const wiggle = Array.from({ length: 400 }, (unused, step) => [
    -87.6 + step * 0.0002,
    41.8 + 0.0003 * Math.sin(step / 5),
  ]);
  it('keeps both ends and drops points on a straight run', () => {
    const straight = [
      [-87.6, 41.8],
      [-87.59, 41.8],
      [-87.58, 41.8],
      [-87.57, 41.8],
    ];
    expect(simplifyLine(straight, 1)).toEqual([straight[0], straight[3]]);
  });
  it('gets under the point limit, keeps the ends and stays near the original line', () => {
    const result = simplifyToMaxPoints(wiggle, 40);
    expect(result.length).toBeLessThanOrEqual(40);
    expect(result[0]).toEqual(wiggle[0]);
    expect(result.at(-1)).toEqual(wiggle.at(-1));
    const original = toCoordinates(wiggle);
    const farthest = Math.max(
      ...toCoordinates(result).map((point) => distanceToLineMeters(point, original)),
    );
    expect(farthest).toBeLessThan(5);
  });
  it('returns the line unchanged when it is already short enough', () => {
    expect(simplifyToMaxPoints(wiggle.slice(0, 10), 40)).toEqual(wiggle.slice(0, 10));
  });
});
describe('toCoordinates', () => {
  it('swaps to latitude and longitude and rounds to 5 decimals', () => {
    const [point] = toCoordinates([[-87.6200049, 41.880016]]);
    expect(point.latitude).toBeCloseTo(41.88002, 8);
    expect(point.longitude).toBeCloseTo(-87.62, 8);
  });
});
