import { describe, it, expect } from 'vitest';
import fastCheck from 'fast-check';
import { isValidBuilding, validateBuilding } from '../src/lib/buildings.ts';
const ring = [
  [-87.62, 41.88],
  [-87.619, 41.88],
  [-87.619, 41.881],
  [-87.62, 41.88],
];
const withFootprint = (footprint) => ({
  id: 'overture:abc',
  footprint,
  centroid: { latitude: 41.8803, longitude: -87.6195 },
  source: 'map',
  sources: ['static'],
});
const brokenPoint = fastCheck.record({
  value: fastCheck.constantFrom(Number.NaN, Infinity, -Infinity),
  index: fastCheck.integer({ min: 0, max: 3 }),
  axis: fastCheck.constantFrom(0, 1),
});
function expectBroken({ value, index, axis }) {
  const footprint = ring.map((point) => [...point]);
  footprint[index][axis] = value;
  expect(isValidBuilding(withFootprint(footprint))).toBe(false);
}
describe('building validation properties (spec 2 R14)', () => {
  it('a record with a non-finite footprint point never passes', () => {
    expect(() => fastCheck.assert(fastCheck.property(brokenPoint, expectBroken))).not.toThrow();
  });
  it('never throws, whatever it is given', () => {
    fastCheck.assert(
      fastCheck.property(fastCheck.anything(), (input) => {
        expect(Array.isArray(validateBuilding(input))).toBe(true);
      }),
    );
  });
});
