import { describe, it, expect } from 'vitest';
import fastCheck from 'fast-check';
import { CHICAGO } from '../src/config/city.ts';
import { buildPlaceCandidates } from '../src/lib/place-builder.ts';
import { rankCandidates } from '../src/lib/place-ranking.ts';
import { assessPlace } from '../src/lib/risk.ts';
import { makeBuilding } from './helpers/buildings.ts';
const reading = {
  windFromDegrees: 200,
  windSpeedMps: 6,
  lowCloudPercent: 80,
  visibilityKm: 4,
};
const conditions = {
  night: '2026-10-16',
  migration: { level: 0.8 },
  weather: { early: reading, middle: reading, late: reading },
};
const buildingArbitrary = fastCheck.record(
  {
    id: fastCheck.uuid(),
    heightMeters: fastCheck.option(fastCheck.integer({ min: 3, max: 400 }), { nil: undefined }),
    kind: fastCheck.option(fastCheck.constantFrom('stadium', 'arena'), { nil: undefined }),
    latitude: fastCheck.double({ min: 41.84, max: 42.06, noNaN: true }),
    longitude: fastCheck.double({ min: -87.69, max: -87.6, noNaN: true }),
  },
  { requiredKeys: ['id', 'latitude', 'longitude'] },
);
const toBuilding = ({ id, ...rest }) => makeBuilding(id, rest);
const buildingsArbitrary = fastCheck
  .array(buildingArbitrary, { minLength: 1, maxLength: 25 })
  .map((items) => [...new Map(items.map((item) => [item.id, item])).values()].map(toBuilding));
const rankedFor = (buildings) =>
  rankCandidates(buildPlaceCandidates(buildings, [], CHICAGO), conditions, CHICAGO.riskOverrides);
const orderOf = (buildings) => rankedFor(buildings).map((entry) => entry.candidate.place.id);
const levelOf = (building) =>
  assessPlace(
    buildPlaceCandidates([building], [], CHICAGO)[0].place,
    conditions,
    CHICAGO.riskOverrides,
  ).level;
const shuffle = (items, picks) => {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const other = picks.next().value % (index + 1);
    [shuffled[index], shuffled[other]] = [shuffled[other], shuffled[index]];
  }
  return shuffled;
};
const RANK = { low: 0, elevated: 1, high: 2 };
function sameOrderWhenShuffled(buildings, picks) {
  expect(orderOf(shuffle(buildings, picks))).toEqual(orderOf(buildings));
}
function ranksExactlyTheScorable(buildings) {
  const scorable = buildings.filter(
    (entry) => entry.heightMeters !== undefined || entry.kind !== undefined,
  );
  expect([...orderOf(buildings)].sort()).toEqual(scorable.map((entry) => entry.id).sort());
}
function levelsNeverRise(buildings) {
  const levels = rankedFor(buildings).map((entry) => RANK[entry.level]);
  expect(levels).toEqual([...levels].sort((first, second) => second - first));
}
function heightNeverLowersLevel(item) {
  const withHeight = toBuilding({ ...item, heightMeters: item.heightMeters ?? 50, kind: 'arena' });
  const without = toBuilding({ ...item, heightMeters: undefined, kind: 'arena' });
  expect(RANK[levelOf(without)]).toBeLessThanOrEqual(RANK[levelOf(withHeight)]);
}
function noGlassReasonWithoutGlassData(buildings) {
  for (const entry of rankedFor(buildings)) {
    expect(entry.reasons).not.toContain('Large areas of lit glass.');
  }
}
const run = (property) => () => fastCheck.assert(property);
describe('place ranking properties (spec 2 R17 to R20)', () => {
  it('gives the same order for the same buildings in any input order (R20)', () => {
    const property = fastCheck.property(
      buildingsArbitrary,
      fastCheck.infiniteStream(fastCheck.nat()),
      sameOrderWhenShuffled,
    );
    expect(run(property)).not.toThrow();
  });
  it('ranks exactly the buildings that have a height or a kind, each once (R17)', () => {
    expect(run(fastCheck.property(buildingsArbitrary, ranksExactlyTheScorable))).not.toThrow();
  });
  it('never puts a lower level above a higher one', () => {
    expect(run(fastCheck.property(buildingsArbitrary, levelsNeverRise))).not.toThrow();
  });
  it('never raises a level when a known height is taken away (R4)', () => {
    expect(run(fastCheck.property(buildingArbitrary, heightNeverLowersLevel))).not.toThrow();
  });
  it('never shows a lit-glass reason for a building with no glass data (R18)', () => {
    expect(
      run(fastCheck.property(buildingsArbitrary, noGlassReasonWithoutGlassData)),
    ).not.toThrow();
  });
});
