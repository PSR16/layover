import { describe, it, expect } from 'vitest';
import { isValidBuilding, keepValidBuildings, validateBuilding } from '../src/lib/buildings.ts';
const ring = [
  [-87.62, 41.88],
  [-87.619, 41.88],
  [-87.619, 41.881],
  [-87.62, 41.88],
];
const good = (overrides = {}) => ({
  id: 'overture:abc',
  footprint: ring,
  centroid: { latitude: 41.8803, longitude: -87.6195 },
  source: 'map',
  sources: ['static'],
  ...overrides,
});
describe('validateBuilding (spec 2 R3, R4, R14)', () => {
  it('accepts a complete record and one with only the required fields', () => {
    expect(validateBuilding(good())).toEqual([]);
    expect(
      validateBuilding(good({ name: 'Hall', heightMeters: 30, kind: 'stadium', osmId: 'way/1' })),
    ).toEqual([]);
  });
  it('rejects anything that is not an object', () => {
    for (const input of [null, undefined, 'x', 4, [], [good()]]) {
      expect(validateBuilding(input)).toEqual(['building is not an object']);
    }
  });
  it('needs an id, a known source and at least one source name', () => {
    expect(validateBuilding(good({ id: '' }))).toContain('id is missing');
    expect(validateBuilding(good({ source: 'live' }))).toContain('source must be map or sample');
    expect(validateBuilding(good({ sources: [] }))).toContain(
      'sources must list at least one source name',
    );
  });
  it('rejects a footprint that is short, open or has a bad point', () => {
    expect(validateBuilding(good({ footprint: ring.slice(0, 3) }))).toContain(
      'footprint needs at least 4 points',
    );
    expect(
      validateBuilding(good({ footprint: ring.slice(0, 3).concat([[-87.1, 41.1]]) })),
    ).toContain('footprint is not closed');
    const bad = [...ring.slice(0, 3), [Number.NaN, 41.88]];
    expect(validateBuilding(good({ footprint: bad }))).toContain(
      'footprint has a point that is not a finite [longitude, latitude]',
    );
  });
  it('rejects coordinates outside the globe', () => {
    const wrongOrder = ring.map(([longitude, latitude]) => [longitude, latitude + 100]);
    expect(isValidBuilding(good({ footprint: wrongOrder }))).toBe(false);
  });
  it('rejects a missing or non-finite centroid', () => {
    expect(validateBuilding(good({ centroid: undefined }))).toContain('centroid is missing');
    expect(
      validateBuilding(good({ centroid: { latitude: Infinity, longitude: -87.6 } })),
    ).toContain('centroid is not a finite latitude and longitude');
  });
  it('leaves height, name and kind missing, and rejects wrong types when they are present', () => {
    expect(validateBuilding(good({ heightMeters: 0 }))).toHaveLength(1);
    expect(validateBuilding(good({ heightMeters: '30' }))).toHaveLength(1);
    expect(validateBuilding(good({ name: 5 }))).toHaveLength(1);
    expect(validateBuilding(good({ kind: 5 }))).toHaveLength(1);
  });
});
describe('keepValidBuildings', () => {
  it('keeps valid records in order and counts the dropped ones', () => {
    const first = good({ id: 'a' });
    const second = good({ id: 'b' });
    const result = keepValidBuildings([first, { id: 'broken' }, second, null]);
    expect(result.buildings).toEqual([first, second]);
    expect(result.dropped).toBe(2);
  });
});
