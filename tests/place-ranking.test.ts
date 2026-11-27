import { describe, it, expect } from 'vitest';
import { CHICAGO } from '../src/config/city.ts';
import { HOTSPOTS } from '../src/data/hotspots.ts';
import { findReplayNight } from '../src/data/replay-nights.ts';
import { buildPlaceCandidates } from '../src/lib/place-builder.ts';
import { rankCandidates } from '../src/lib/place-ranking.ts';
import { makeBuilding, realBuildings } from './helpers/buildings.ts';
const conditionsOf = (nightId) => {
  const night = findReplayNight(nightId);
  return { night: night.night, migration: night.migration, weather: night.weather };
};
const candidates = buildPlaceCandidates(realBuildings(), HOTSPOTS, CHICAGO);
const RANK = { low: 0, elevated: 1, high: 2 };
describe('rankCandidates (spec 2 R17 to R20)', () => {
  const ranked = rankCandidates(candidates, conditionsOf('news-2023-10-04'), CHICAGO.riskOverrides);
  it('ranks every candidate once, highest level first', () => {
    expect(ranked).toHaveLength(candidates.length);
    for (let index = 1; index < ranked.length; index += 1) {
      expect(RANK[ranked[index - 1].level]).toBeGreaterThanOrEqual(RANK[ranked[index].level]);
    }
  });
  it('gives only a level, plain reasons and missing names, with no numbers (R19)', () => {
    for (const entry of ranked.slice(0, 50)) {
      expect(Object.keys(entry).sort()).toEqual([
        'assumesLit',
        'candidate',
        'level',
        'missingInputs',
        'reasons',
      ]);
      expect(entry.reasons.length).toBeGreaterThan(0);
      expect(entry.reasons.join(' ')).not.toMatch(/\d/);
      expect(entry.reasons.join(' ')).not.toMatch(/\b(dead|death|died|kill|casualt|fatal)/i);
    }
  });
  it('puts the untreated-style hotspots above plain buildings on a heavy night', () => {
    const top = ranked.slice(0, 5).map((entry) => entry.candidate.hotspot?.id);
    expect(top).toContain('soldier-field');
  });
  it('says lighting is assumed, since no place has a lit flag (R18, R30)', () => {
    expect(ranked.every((entry) => entry.assumesLit)).toBe(true);
  });
  it('lists glass as missing for Soldier Field, which has no glass value (R4, R22)', () => {
    const soldier = ranked.find((entry) => entry.candidate.hotspot?.id === 'soldier-field');
    expect(soldier.missingInputs).toContain('litGlassArea');
  });
  it('does not change the list it was given', () => {
    const copy = [...candidates];
    rankCandidates(candidates, conditionsOf('news-2023-10-04'), CHICAGO.riskOverrides);
    expect(candidates).toEqual(copy);
  });
  it('ranks differently on a quiet night: no place scores high', () => {
    const quiet = rankCandidates(
      candidates,
      conditionsOf('radar-2008-10-30'),
      CHICAGO.riskOverrides,
    );
    expect(quiet.some((entry) => entry.level === 'high')).toBe(false);
  });
  it('breaks ties by id, so equal places keep a fixed order', () => {
    const twins = [
      makeBuilding('b', { heightMeters: 20 }),
      makeBuilding('a', { heightMeters: 20 }),
    ];
    const result = rankCandidates(
      buildPlaceCandidates(twins, [], CHICAGO),
      conditionsOf('radar-2018-05-01'),
    );
    expect(result.map((entry) => entry.candidate.place.id)).toEqual(['a', 'b']);
  });
});
