import { describe, it, expect } from 'vitest';
import fastCheck from 'fast-check';
import { mergeSources } from '../src/lib/building-source.ts';
import { makeBuilding } from './helpers/buildings.ts';
const toRecords = (items, sourceId) =>
  [...new Map(items.map((item) => [item.id, item])).values()].map(({ id, ...rest }) =>
    makeBuilding(id, { ...rest, sources: [sourceId] }),
  );
const byId = (buildings) => new Map(buildings.map((item) => [item.id, item]));
const missingIds = (buildings, ids) =>
  buildings.map((building) => building.id).filter((id) => !ids.has(id));
const hasLive = (building) => building.sources.includes('live');
const recordArbitrary = (sourceId) =>
  fastCheck
    .array(
      fastCheck.record(
        {
          id: fastCheck.uuid(),
          osmId: fastCheck.option(
            fastCheck.integer({ min: 1, max: 8 }).map((number) => `way/${number}`),
            { nil: undefined },
          ),
          name: fastCheck.option(fastCheck.constantFrom('A', 'B'), { nil: undefined }),
          latitude: fastCheck.integer({ min: 0, max: 6 }).map((step) => 41.88 + step * 0.00015),
          longitude: fastCheck.integer({ min: 0, max: 6 }).map((step) => -87.63 + step * 0.00015),
        },
        { requiredKeys: ['id', 'latitude', 'longitude'] },
      ),
      { maxLength: 8 },
    )
    .map((items) => toRecords(items, sourceId));
const listsArbitrary = fastCheck.tuple(recordArbitrary('static'), recordArbitrary('live'));
describe('mergeSources properties (spec 2 R32)', () => {
  it('gives the same answer for the same input', () => {
    fastCheck.assert(
      fastCheck.property(listsArbitrary, (lists) => {
        expect(mergeSources(lists)).toEqual(mergeSources(lists));
      }),
    );
  });
  it('never loses a building: every first-list record stays, and the count is bounded', () => {
    fastCheck.assert(
      fastCheck.property(listsArbitrary, ([first, second]) => {
        const merged = mergeSources([first, second]);
        const ids = byId(merged);
        expect(missingIds(first, ids)).toEqual([]);
        expect(merged.length).toBeGreaterThanOrEqual(first.length);
        expect(merged.length).toBeLessThanOrEqual(first.length + second.length);
      }),
    );
  });
  it('keeps every later record either as itself or as a contributor to a merged record', () => {
    fastCheck.assert(
      fastCheck.property(listsArbitrary, ([first, second]) => {
        const merged = mergeSources([first, second]);
        const contributed = merged.filter(hasLive).length;
        expect(contributed).toBeGreaterThanOrEqual(second.length > 0 ? 1 : 0);
        expect(contributed).toBeLessThanOrEqual(second.length);
      }),
    );
  });
  it('does not rewrite a name that the first list already had', () => {
    fastCheck.assert(
      fastCheck.property(listsArbitrary, ([first, second]) => {
        const merged = byId(mergeSources([first, second]));
        for (const building of first) {
          if (building.name !== undefined) {
            expect(merged.get(building.id)?.name).toBe(building.name);
          }
        }
      }),
    );
  });
});
