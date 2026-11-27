import { describe, it, expect } from 'vitest';
import {
  ringAreaSquareMeters,
  ringCenter,
  roundRing,
  roundTo,
  simplifyRing,
} from '../tools/extract-geometry.ts';
// A square about 100 m on a side near Chicago: 0.0009 degrees of latitude is about 100 m.
const SIDE_LATITUDE = 0.0009;
const SIDE_LONGITUDE = 0.0012;
const square = [
  [-87.62, 41.88],
  [-87.62 + SIDE_LONGITUDE, 41.88],
  [-87.62 + SIDE_LONGITUDE, 41.88 + SIDE_LATITUDE],
  [-87.62, 41.88 + SIDE_LATITUDE],
  [-87.62, 41.88],
];
describe('ringAreaSquareMeters', () => {
  it('measures a square of about 100 by 100 m', () => {
    const area = ringAreaSquareMeters(square);
    expect(area).toBeGreaterThan(9000);
    expect(area).toBeLessThan(11_000);
  });
  it('gives the same area for either winding direction', () => {
    expect(ringAreaSquareMeters([...square].reverse())).toBeCloseTo(
      ringAreaSquareMeters(square),
      6,
    );
  });
});
describe('ringCenter', () => {
  it('is the middle of the bounding box', () => {
    const center = ringCenter(square);
    expect(center.longitude).toBeCloseTo(-87.62 + SIDE_LONGITUDE / 2, 8);
    expect(center.latitude).toBeCloseTo(41.88 + SIDE_LATITUDE / 2, 8);
  });
});
describe('simplifyRing', () => {
  const withBump = [
    square[0],
    [-87.62 + SIDE_LONGITUDE / 2, 41.88 + 0.0000001],
    square[1],
    square[2],
    square[3],
    square[4],
  ];
  it('drops a point that sits within the tolerance of the line', () => {
    const result = simplifyRing(withBump, 1);
    expect(result).toHaveLength(5);
    expect(result).not.toContainEqual(withBump[1]);
  });
  it('keeps a point that is farther than the tolerance', () => {
    const farBump = [...withBump];
    farBump[1] = [-87.62 + SIDE_LONGITUDE / 2, 41.88 + 0.0002];
    expect(simplifyRing(farBump, 1)).toHaveLength(6);
  });
  it('keeps the ring closed and the first point first', () => {
    const result = simplifyRing(withBump, 1);
    expect(result[0]).toEqual(result.at(-1));
    expect(result[0]).toEqual(square[0]);
  });
  it('returns a small ring unchanged', () => {
    const triangle = [square[0], square[1], square[2], square[0]];
    expect(simplifyRing(triangle, 100)).toEqual(triangle);
  });
  it('keeps the area within a few percent at 1 m tolerance on a wavy ring', () => {
    const wavy = Array.from({ length: 41 }, (unused, step) => {
      const angle = (step / 40) * 2 * Math.PI;
      const radius = 0.0005 + 0.0000005 * Math.sin(angle * 9);
      return [-87.62 + radius * Math.cos(angle), 41.88 + radius * Math.sin(angle)];
    });
    wavy[40] = wavy[0];
    const result = simplifyRing(wavy, 1);
    expect(result.length).toBeLessThan(wavy.length);
    const ratio = ringAreaSquareMeters(result) / ringAreaSquareMeters(wavy);
    expect(ratio).toBeGreaterThan(0.97);
    expect(ratio).toBeLessThan(1.03);
  });
});
describe('rounding', () => {
  it('rounds a number to the given decimals', () => {
    expect(roundTo(-87.6200049, 5)).toBeCloseTo(-87.62, 8);
    expect(roundTo(41.880016, 5)).toBeCloseTo(41.88002, 8);
  });
  it('rounds every point of a ring', () => {
    const [[longitude, latitude]] = roundRing([[-87.6200049, 41.880016]], 5);
    expect(longitude).toBeCloseTo(-87.62, 8);
    expect(latitude).toBeCloseTo(41.88002, 8);
  });
});
