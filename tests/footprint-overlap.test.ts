import { describe, it, expect } from 'vitest';
import { overlapOfSmaller } from '../src/lib/footprint-overlap.ts';
import { square } from './helpers/buildings.ts';

const SIZE = 0.0002;

describe('overlapOfSmaller (spec 2 R32)', () => {
  it('gives about half when a square is shifted by half its width', () => {
    const base = square(41.88, -87.63);
    const shifted = square(41.88, -87.63 + SIZE / 2);
    expect(overlapOfSmaller(base, shifted)).toBeCloseTo(0.5, 5);
  });
  it('gives 0 for a small footprint that sits in the notch of an L-shaped one', () => {
    const [west, south] = [-87.63, 41.88];
    const lShape: [number, number][] = [
      [west, south],
      [west + SIZE, south],
      [west + SIZE, south + SIZE / 2],
      [west + SIZE / 2, south + SIZE / 2],
      [west + SIZE / 2, south + SIZE],
      [west, south + SIZE],
      [west, south],
    ];
    const inNotch = square(south + SIZE * 0.6, west + SIZE * 0.6).map(
      ([x, y]): [number, number] => [
        west + SIZE * 0.6 + (x - (west + SIZE * 0.6)) / 4,
        south + SIZE * 0.6 + (y - (south + SIZE * 0.6)) / 4,
      ],
    );
    expect(overlapOfSmaller(lShape, inNotch)).toBe(0);
  });
});
