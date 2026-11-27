import { describe, it, expect } from 'vitest';
import { mergeSources, mergeRecords } from '../src/lib/building-source.ts';
import { overlapOfSmaller } from '../src/lib/footprint-overlap.ts';
import { makeBuilding, square } from './helpers/buildings.ts';
const from = (sourceId, id, overrides = {}) =>
  makeBuilding(id, { sources: [sourceId], ...overrides });
describe('mergeSources (spec 2 R32)', () => {
  it('merges records with the same OpenStreetMap ID even when footprints differ', () => {
    const earlier = from('static', 'a', { osmId: 'way/1', latitude: 41.88 });
    const later = from('live', 'b', { osmId: 'way/1', latitude: 41.9 });
    const merged = mergeSources([[earlier], [later]]);
    expect(merged).toHaveLength(1);
    expect(merged[0].id).toBe('a');
    expect(merged[0].sources).toEqual(['static', 'live']);
  });
  it('keeps two records apart when both have different OpenStreetMap IDs, even on the same spot', () => {
    const earlier = from('static', 'a', { osmId: 'way/1' });
    const later = from('live', 'b', { osmId: 'way/2' });
    expect(mergeSources([[earlier], [later]])).toHaveLength(2);
  });
  it('merges by footprint when one record has no OpenStreetMap ID', () => {
    const merged = mergeSources([[from('static', 'a', { osmId: 'way/1' })], [from('live', 'b')]]);
    expect(merged).toHaveLength(1);
  });
  it('lets the earlier source win and the later one fill only missing fields', () => {
    const earlier = from('static', 'a', { name: 'Old name', heightMeters: 40 });
    const later = from('live', 'b', { name: 'New name', heightMeters: 90, kind: 'arena' });
    const [merged] = mergeSources([[earlier], [later]]);
    expect(merged).toMatchObject({ name: 'Old name', heightMeters: 40, kind: 'arena' });
  });
  it('does not merge adjacent buildings that only share an edge', () => {
    const left = from('static', 'a', { latitude: 41.88, longitude: -87.63 });
    const right = from('live', 'b', { latitude: 41.88, longitude: -87.63 + 0.0002 });
    expect(mergeSources([[left], [right]])).toHaveLength(2);
  });
  it('does not merge small overlaps and does merge large ones', () => {
    const base = from('static', 'a', { latitude: 41.88, longitude: -87.63 });
    const slight = from('live', 'b', { latitude: 41.88, longitude: -87.63 + 0.00016 });
    const heavy = from('live', 'c', { latitude: 41.88, longitude: -87.63 + 0.00006 });
    expect(mergeSources([[base], [slight]])).toHaveLength(2);
    expect(mergeSources([[base], [heavy]])).toHaveLength(1);
  });
  it('uses the smaller footprint for the overlap share', () => {
    const big = square(41.88, -87.63).map(([x, y]) => [x * 1, y * 1]);
    const small = square(41.88, -87.63).map(([x, y]) => [
      -87.63 + (x + 87.63) / 4 + 0.00005,
      41.88 + (y - 41.88) / 4 + 0.00005,
    ]);
    expect(overlapOfSmaller(big, small)).toBe(1);
  });
  it('never merges two records from the same source', () => {
    const twin = [from('static', 'a'), from('static', 'b')];
    expect(mergeSources([twin])).toHaveLength(2);
    expect(mergeSources([twin, [from('live', 'c')]])).toHaveLength(2);
  });
  it('marks a merged record as sample when either record is sample', () => {
    const merged = mergeRecords(from('static', 'a'), from('live', 'b', { source: 'sample' }));
    expect(merged.source).toBe('sample');
  });
  it('does not change its inputs', () => {
    const earlier = from('static', 'a');
    mergeSources([[earlier], [from('live', 'b', { name: 'X' })]]);
    expect(earlier.name).toBeUndefined();
    expect(earlier.sources).toEqual(['static']);
  });
});
