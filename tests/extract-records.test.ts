import { describe, it, expect } from 'vitest';
import { validateBuilding } from '../src/lib/buildings.ts';
import {
  DEFAULT_RULES,
  kindOf,
  osmIdOf,
  outerRing,
  selectBuildings,
  toRecord,
} from '../tools/extract-records.ts';
const big = [
  [-87.62, 41.88],
  [-87.619, 41.88],
  [-87.619, 41.8809],
  [-87.62, 41.8809],
  [-87.62, 41.88],
];
const tiny = [
  [-87.62, 41.88],
  [-87.61999, 41.88],
  [-87.61999, 41.88001],
  [-87.62, 41.88001],
  [-87.62, 41.88],
];
const feature = (overrides = {}, ring = big) => ({
  id: 'abc',
  geometry: { type: 'Polygon', coordinates: [ring] },
  properties: {},
  ...overrides,
});
describe('outerRing', () => {
  it('takes the first ring of a polygon', () => {
    expect(outerRing(feature().geometry)).toEqual(big);
  });
  it('takes the largest polygon of a multipolygon', () => {
    const geometry = { type: 'MultiPolygon', coordinates: [[tiny], [big]] };
    expect(outerRing(geometry)).toEqual(big);
  });
  it('gives null for other shapes', () => {
    expect(outerRing({ type: 'Point', coordinates: [0, 0] })).toBeNull();
  });
});
describe('osmIdOf and kindOf', () => {
  it('reads a way, relation or node ID from the OpenStreetMap source', () => {
    const sourceOf = (recordId) => [
      { dataset: 'Microsoft ML Buildings' },
      { dataset: 'OpenStreetMap', record_id: recordId },
    ];
    expect(osmIdOf(sourceOf('w95357362@9'))).toBe('way/95357362');
    expect(osmIdOf(sourceOf('r12@1'))).toBe('relation/12');
    expect(osmIdOf(sourceOf('n7@2'))).toBe('node/7');
  });
  it('gives undefined without an OpenStreetMap source', () => {
    expect(osmIdOf([{ dataset: 'USGS Lidar' }])).toBeUndefined();
    expect(osmIdOf(null)).toBeUndefined();
  });
  it('maps only classes the risk engine knows as venue kinds', () => {
    expect(kindOf('stadium')).toBe('stadium');
    expect(kindOf('arena')).toBe('arena');
    expect(kindOf('university')).toBeUndefined();
    expect(kindOf(null)).toBeUndefined();
  });
});
describe('toRecord (spec 2 R1, R3, R4)', () => {
  it('makes a record that passes validation', () => {
    const record = toRecord(
      feature({ properties: { height: 30.04, names: { primary: ' Hall ' } } }),
      DEFAULT_RULES,
    );
    expect(validateBuilding(record)).toEqual([]);
    expect(record.heightMeters).toBeCloseTo(30, 5);
    expect(record.name).toBe('Hall');
    expect(record.sources).toEqual(['static']);
  });
  it('leaves height, name, kind and OSM ID out when the source has none', () => {
    const record = toRecord(
      feature({ properties: { height: null, names: { primary: '' }, class: 'house' } }),
      DEFAULT_RULES,
    );
    expect(Object.keys(record).sort()).toEqual([
      'centroid',
      'footprint',
      'id',
      'source',
      'sources',
    ]);
  });
  it('skips underground buildings and shapes with no ring', () => {
    expect(toRecord(feature({ properties: { is_underground: true } }), DEFAULT_RULES)).toBeNull();
    expect(
      toRecord(feature({ geometry: { type: 'Point', coordinates: [0, 0] } }), DEFAULT_RULES),
    ).toBeNull();
  });
  it('ignores a height that is zero, negative, not a number or rounds to zero', () => {
    for (const height of [0, -3, Number.NaN, 0.04]) {
      expect(
        toRecord(feature({ properties: { height } }), DEFAULT_RULES).heightMeters,
      ).toBeUndefined();
    }
  });
});
describe('selectBuildings', () => {
  const features = [
    feature({ id: 'b-big-bare' }),
    feature({ id: 'a-tiny-bare' }, tiny),
    feature({ id: 'c-tiny-height', properties: { height: 12 } }, tiny),
    feature({ id: 'd-underground', properties: { is_underground: true } }),
  ];
  it('keeps known buildings and big bare footprints, and counts what it drops', () => {
    const { buildings, dropped } = selectBuildings(features, DEFAULT_RULES);
    expect(buildings.map((building) => building.id)).toEqual(['b-big-bare', 'c-tiny-height']);
    expect(dropped).toEqual({ unusable: 1, smallAndBare: 1 });
  });
  it('gives the same output in any input order (sorted by ID)', () => {
    const forward = selectBuildings(features, DEFAULT_RULES);
    const backward = selectBuildings([...features].reverse(), DEFAULT_RULES);
    expect(JSON.stringify(backward.buildings)).toBe(JSON.stringify(forward.buildings));
  });
});
