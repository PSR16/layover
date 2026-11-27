import { describe, it, expect } from 'vitest';
import { loadBuildings, staticSource, BUILDING_SOURCES } from '../src/api/sources.ts';
import { makeBuilding } from './helpers/buildings.ts';
const working = (id, buildings) => ({
  id,
  load: async () => ({ buildings, savedOn: '2026-11-27', fromCache: false }),
});
const broken = (id, error) => ({
  id,
  load: async () => {
    throw error;
  },
});
describe('static source (spec 2 R31)', () => {
  it('loads each study area from the extract', async () => {
    for (const area of ['loop', 'lakefront', 'evanston']) {
      const result = await staticSource.load(area);
      expect(result.buildings.length).toBeGreaterThan(100);
      expect(result.savedOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });
  it('rejects an unknown area', async () => {
    await expect(staticSource.load('mars')).rejects.toThrow('mars');
  });
  it('is the first source in the list', () => {
    expect(BUILDING_SOURCES[0]).toBe(staticSource);
  });
});
describe('loadBuildings (spec 2 R12, R32, R33)', () => {
  it('reports the static extract as loaded for a real area', async () => {
    const result = await loadBuildings('evanston');
    expect(result.loaded).toEqual([
      { id: 'static', savedOn: expect.any(String), fromCache: false },
    ]);
    expect(result.failed).toEqual([]);
    expect(result.buildings.length).toBeGreaterThan(100);
  });
  it('keeps the working source when another one fails, in either order', async () => {
    const good = working('static', [makeBuilding('a')]);
    const bad = broken('live', new Error('Overpass timed out'));
    for (const sources of [
      [good, bad],
      [bad, good],
    ]) {
      const result = await loadBuildings('loop', sources);
      expect(result.buildings.map((building) => building.id)).toEqual(['a']);
      expect(result.loaded.map((item) => item.id)).toEqual(['static']);
      expect(result.failed).toEqual([{ id: 'live', reason: 'Overpass timed out' }]);
    }
  });
  it('survives a source that throws before returning a promise or throws a non-error', async () => {
    const sync = {
      id: 'sync',
      load: () => {
        throw new Error('boom');
      },
    };
    const odd = broken('odd', 'text');
    const result = await loadBuildings('loop', [sync, odd, working('static', [makeBuilding('a')])]);
    expect(result.failed.map((item) => item.id)).toEqual(['sync', 'odd']);
    expect(result.failed[1].reason).toBe('Could not load');
    expect(result.buildings).toHaveLength(1);
  });
  it('returns no buildings and every failure when all sources fail', async () => {
    const result = await loadBuildings('loop', [
      broken('a', new Error('x')),
      broken('b', new Error('y')),
    ]);
    expect(result.buildings).toEqual([]);
    expect(result.failed).toHaveLength(2);
  });
  it('merges two sources in list order', async () => {
    const first = working('static', [makeBuilding('a', { name: 'Hall', sources: ['static'] })]);
    const second = working('live', [makeBuilding('b', { heightMeters: 30, sources: ['live'] })]);
    const result = await loadBuildings('loop', [first, second]);
    expect(result.buildings).toHaveLength(1);
    expect(result.buildings[0]).toMatchObject({
      name: 'Hall',
      heightMeters: 30,
      sources: ['static', 'live'],
    });
  });
});
