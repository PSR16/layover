import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import { HOTSPOTS } from '../src/data/hotspots.ts';
import { CHICAGO_RISK_OVERRIDES } from '../src/config/chicago-risk.ts';
import { findReplayNight } from '../src/data/replay-nights.ts';
import { DEFAULT_CONFIG } from '../src/lib/risk-config.ts';
import { matchHotspot } from '../src/lib/hotspots.ts';
import { assessPlace } from '../src/lib/risk.ts';
const AREAS = ['loop', 'lakefront', 'evanston'];
const allBuildings = AREAS.flatMap(
  (area) => JSON.parse(readFileSync(`src/data/buildings-${area}.json`, 'utf8')).buildings,
);
const research = readFileSync('docs/research.md', 'utf8');
const building = (overrides = {}) => ({
  id: 'b1',
  name: 'Soldier Field',
  footprint: [],
  centroid: { latitude: 41.8623, longitude: -87.6176 },
  source: 'map',
  sources: ['static'],
  ...overrides,
});
const hotspot = (match = {}) => ({
  ...HOTSPOTS.find((entry) => entry.id === 'soldier-field'),
  match: { near: { latitude: 41.8623, longitude: -87.6176 }, maxDistanceMeters: 200, ...match },
});
describe('matchHotspot (spec 2 R8)', () => {
  it('matches by building ID first, even when a nearer building has the same name', () => {
    const wanted = building({ id: 'wanted', centroid: { latitude: 41.8629, longitude: -87.6176 } });
    const nearer = building({ id: 'nearer' });
    expect(matchHotspot(hotspot({ buildingId: 'wanted' }), [nearer, wanted])).toBe(wanted);
  });
  it('then by OpenStreetMap ID', () => {
    const wanted = building({ id: 'wanted', osmId: 'way/5', name: 'Other name' });
    expect(matchHotspot(hotspot({ osmId: 'way/5' }), [building(), wanted])).toBe(wanted);
  });
  it('then by name and distance, choosing the nearest building with that name', () => {
    const far = building({ id: 'far', centroid: { latitude: 41.8635, longitude: -87.6176 } });
    const near = building({ id: 'near' });
    expect(matchHotspot(hotspot(), [far, near])).toBe(near);
  });
  it('ignores the case and spacing of a name', () => {
    expect(matchHotspot(hotspot(), [building({ name: ' SOLDIER field ' })])).not.toBeNull();
  });
  it('gives null for a right name that is too far away, a wrong name, or an empty map', () => {
    const faraway = building({ centroid: { latitude: 41.9, longitude: -87.6 } });
    expect(matchHotspot(hotspot(), [faraway])).toBeNull();
    expect(matchHotspot(hotspot(), [building({ name: 'Wrigley Field' })])).toBeNull();
    expect(matchHotspot(hotspot(), [])).toBeNull();
  });
});
describe('the hotspot list (spec 2 R6, R7, R10)', () => {
  it('holds the three sites, each with a reason and a dated note with evidence', () => {
    expect(HOTSPOTS.map((entry) => entry.id)).toEqual([
      'mccormick-lakeside',
      'soldier-field',
      'kellogg-global-hub',
    ]);
    for (const entry of HOTSPOTS) {
      expect(entry.reason.length).toBeGreaterThan(10);
      expect(entry.note.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(entry.note.text.length).toBeGreaterThan(20);
      expect(entry.note.evidence.length).toBeGreaterThan(0);
    }
  });
  it('cites only evidence IDs that exist in docs/research.md, or "assumption"', () => {
    for (const id of HOTSPOTS.flatMap((entry) => entry.note.evidence)) {
      expect(id === 'assumption' || research.includes(`| ${id} |`)).toBe(true);
    }
  });
  it('keeps every value in range and uses only venue kinds the engine knows', () => {
    const kinds = DEFAULT_CONFIG.weights.stadium.kinds;
    for (const entry of HOTSPOTS) {
      if (entry.litGlassShare !== undefined) {
        expect(entry.litGlassShare).toBeGreaterThanOrEqual(0);
        expect(entry.litGlassShare).toBeLessThanOrEqual(1);
      }
      expect(entry.kind === undefined || kinds.includes(entry.kind)).toBe(true);
    }
  });
  it('finds every hotspot in the static extract by its building ID, and by name and distance too', () => {
    for (const entry of HOTSPOTS) {
      const byId = matchHotspot(entry, allBuildings);
      expect(byId?.id).toBe(entry.match.buildingId);
      expect(byId?.osmId).toBe(entry.match.osmId);
      const withoutIds = {
        ...entry,
        match: { ...entry.match, buildingId: undefined, osmId: undefined },
      };
      expect(matchHotspot(withoutIds, allBuildings)?.id).toBe(entry.match.buildingId);
    }
  });
  it('leaves Soldier Field lit glass out and gives it the map kind, so the score lists glass as missing', () => {
    const soldier = HOTSPOTS.find((entry) => entry.id === 'soldier-field');
    expect(soldier.litGlassShare).toBeUndefined();
    expect(soldier.kind).toBe('stadium');
  });
});
describe('McCormick Place hotspot scoring (spec 2 R9: no extra venue kind)', () => {
  const mccormick = HOTSPOTS.find((entry) => entry.id === 'mccormick-lakeside');
  const placeFor = (treatment) => ({
    id: mccormick.id,
    litGlassArea: mccormick.litGlassShare,
    treeNear: mccormick.treeNear,
    heightMeters: 30,
    lakeDistanceMeters: 568,
    birdSafeTreatment: treatment,
  });
  const levelOn = (nightId, treatment) => {
    const night = findReplayNight(nightId);
    const conditions = { night: night.night, migration: night.migration, weather: night.weather };
    return assessPlace(placeFor(treatment), conditions, CHICAGO_RISK_OVERRIDES).level;
  };
  it('has no venue kind, because its lit glass already carries the score the calibration used', () => {
    expect(mccormick.kind).toBeUndefined();
    expect(DEFAULT_CONFIG.weights.stadium.kinds).not.toContain('convention-center');
  });
  it('scores high on the 2023 night when untreated and lower once treatment is counted', () => {
    expect(levelOn('news-2023-10-04', 'none')).toBe('high');
    expect(levelOn('news-2023-10-04', 'partial')).toBe('elevated');
  });
  it('scores low on a quiet night', () => {
    expect(levelOn('radar-2008-10-30', 'none')).toBe('low');
  });
});
