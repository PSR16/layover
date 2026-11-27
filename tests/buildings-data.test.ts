import { readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { describe, it, expect } from 'vitest';
import { validateBuilding } from '../src/lib/buildings.ts';
const AREAS = ['loop', 'lakefront', 'evanston'];
const BUDGET_GZIP_BYTES = 500_000;
const load = (area) => readFileSync(`src/data/buildings-${area}.json`, 'utf8');
const parsed = Object.fromEntries(AREAS.map((area) => [area, JSON.parse(load(area))]));
describe('static building extract (spec 2 R1, R2, R3, R5)', () => {
  it('stays under the size budget for all three areas together', () => {
    const total = AREAS.reduce((sum, area) => sum + gzipSync(load(area)).length, 0);
    expect(total).toBeLessThan(BUDGET_GZIP_BYTES);
  });
  it('names its release, build date, script and licence in every header', () => {
    for (const area of AREAS) {
      const { header } = parsed[area];
      expect(header.overtureRelease).toMatch(/^\d{4}-\d{2}-\d{2}\.\d+$/);
      expect(header.builtOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(header.builtBy).toBe('tools/build-building-extract.ts');
      expect(header.licence).toBe('ODbL 1.0');
      expect(header.attribution).toContain('OpenStreetMap contributors');
    }
  });
  it('holds only valid records, sorted by ID with no repeats, and the header counts match', () => {
    for (const area of AREAS) {
      const { header, buildings } = parsed[area];
      const ids = buildings.map((building) => building.id);
      expect(buildings.every((building) => validateBuilding(building).length === 0)).toBe(true);
      expect(ids).toEqual([...ids].sort((first, second) => first.localeCompare(second)));
      expect(new Set(ids).size).toBe(ids.length);
      expect(header.counts.kept).toBe(buildings.length);
    }
  });
  it('never invents a height: every height is a positive number or absent', () => {
    for (const area of AREAS) {
      for (const building of parsed[area].buildings) {
        expect(building.heightMeters === undefined || building.heightMeters > 0).toBe(true);
      }
    }
  });
  it('keeps the three sites from the news in the data (names or heights as the map has them)', () => {
    const named = AREAS.flatMap((area) => parsed[area].buildings).filter(
      (building) => building.name,
    );
    const has = (text) => named.some((building) => building.name.includes(text));
    expect(has('Soldier Field')).toBe(true);
    expect(has('McCormick')).toBe(true);
    expect(has('Kellogg')).toBe(true);
  });
});
