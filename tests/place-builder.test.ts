import { describe, it, expect } from 'vitest';
import { CHICAGO } from '../src/config/city.ts';
import { HOTSPOTS } from '../src/data/hotspots.ts';
import { buildPlaceCandidates } from '../src/lib/place-builder.ts';
import { lakeDistanceMeters } from '../src/lib/city-config.ts';
import { makeBuilding, realBuildings } from './helpers/buildings.ts';
const MCCORMICK_ID = '22e8aa23-5afa-483f-844c-e40b64fc220e';
const ids = (candidates) => candidates.map((candidate) => candidate.place.id);
describe('buildPlaceCandidates: which buildings are scored (spec 2 R17)', () => {
  const bare = makeBuilding('bare');
  const tall = makeBuilding('tall', { heightMeters: 40 });
  const venue = makeBuilding('venue', { kind: 'stadium' });
  it('scores buildings with a height or a venue kind, and leaves bare footprints out', () => {
    const result = buildPlaceCandidates([bare, tall, venue], [], CHICAGO);
    expect(ids(result)).toEqual(['tall', 'venue']);
  });
  it('lists every hotspot, even when the map has no building for it', () => {
    const result = buildPlaceCandidates([], HOTSPOTS, CHICAGO);
    expect(ids(result)).toEqual(['mccormick-lakeside', 'soldier-field', 'kellogg-global-hub']);
    expect(result.every((candidate) => candidate.building === null)).toBe(true);
    expect(result[0].coordinate).toEqual(HOTSPOTS[0].match.near);
  });
  it('shows a matched hotspot once, not again as an ordinary building', () => {
    const real = realBuildings();
    const result = buildPlaceCandidates(real, HOTSPOTS, CHICAGO);
    const mccormick = result.filter((candidate) => candidate.place.id === MCCORMICK_ID);
    expect(mccormick).toHaveLength(1);
    expect(mccormick[0].hotspot.id).toBe('mccormick-lakeside');
    expect(new Set(ids(result)).size).toBe(result.length);
  });
});
describe('buildPlaceCandidates: what each place carries', () => {
  const tall = makeBuilding('tall', { heightMeters: 40, name: 'Tall Hall' });
  const [candidate] = buildPlaceCandidates([tall], [], CHICAGO);
  it('takes height, kind and lake distance from the map and sets no lighting (R16, R30)', () => {
    expect(candidate.place.heightMeters).toBe(40);
    expect(candidate.place.lakeDistanceMeters).toBeCloseTo(
      lakeDistanceMeters(CHICAGO, tall.centroid),
      6,
    );
    expect(Object.keys(candidate.place)).not.toContain('lit');
    expect(Object.keys(candidate.place)).not.toContain('litGlassArea');
    expect(candidate.name).toBe('Tall Hall');
    expect(candidate.usesSampleValues).toBe(false);
  });
  it('leaves the lake distance out when the city has no shoreline (R16)', () => {
    const inland = { ...CHICAGO, shoreline: undefined };
    const [inlandCandidate] = buildPlaceCandidates([tall], [], inland);
    expect('lakeDistanceMeters' in inlandCandidate.place).toBe(false);
  });
  it('keeps a missing height missing, with no invented value (R4)', () => {
    const [venueCandidate] = buildPlaceCandidates(
      [makeBuilding('v', { kind: 'arena' })],
      [],
      CHICAGO,
    );
    expect('heightMeters' in venueCandidate.place).toBe(false);
  });
  it('lets hotspot values sit on top of the map, and labels the place as sample (R7, R8)', () => {
    const result = buildPlaceCandidates(realBuildings(), HOTSPOTS, CHICAGO);
    const mccormick = result.find((entry) => entry.place.id === MCCORMICK_ID);
    expect(mccormick.place.litGlassArea).toBeCloseTo(0.71, 8);
    expect(mccormick.place.birdSafeTreatment).toBe('partial');
    expect(mccormick.place.heightMeters).toBe(30);
    expect(mccormick.usesSampleValues).toBe(true);
    expect(mccormick.name).toBe('McCormick Place Lakeside Center');
  });
  it('prefers the hotspot kind over the map kind when they differ (R8)', () => {
    const hotspot = { ...HOTSPOTS.find((entry) => entry.id === 'soldier-field'), kind: 'arena' };
    const stadium = makeBuilding(hotspot.match.buildingId, {
      kind: 'stadium',
      name: 'Soldier Field',
    });
    const [candidate] = buildPlaceCandidates([stadium], [hotspot], CHICAGO);
    expect(candidate.place.kind).toBe('arena');
  });
  it('gives Soldier Field its kind and no glass value', () => {
    const result = buildPlaceCandidates(realBuildings(), HOTSPOTS, CHICAGO);
    const soldier = result.find((entry) => entry.hotspot?.id === 'soldier-field');
    expect(soldier.place.kind).toBe('stadium');
    expect('litGlassArea' in soldier.place).toBe(false);
  });
});
describe('with the real extract', () => {
  it('scores a few thousand places, each with a finite coordinate and a unique id', () => {
    const result = buildPlaceCandidates(realBuildings(), HOTSPOTS, CHICAGO);
    expect(result.length).toBeGreaterThan(2000);
    expect(new Set(ids(result)).size).toBe(result.length);
    for (const entry of result) {
      expect(Number.isFinite(entry.coordinate.latitude)).toBe(true);
      expect(Number.isFinite(entry.coordinate.longitude)).toBe(true);
    }
  });
});
