import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
const file = JSON.parse(readFileSync('src/data/chicago-shoreline.json', 'utf8'));
describe('shoreline file (spec 2 R15)', () => {
  it('names its source, licence, script and build date', () => {
    expect(file.header.source).toContain('OpenStreetMap');
    expect(file.header.licence).toBe('ODbL 1.0');
    expect(file.header.attribution).toContain('OpenStreetMap contributors');
    expect(file.header.builtBy).toBe('tools/build-shoreline.ts');
    expect(file.header.builtOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
  it('has at most 200 points and the header counts match', () => {
    expect(file.points.length).toBeLessThanOrEqual(200);
    expect(file.header.pointsAfter).toBe(file.points.length);
    expect(file.header.pointsBefore).toBeGreaterThan(file.points.length);
  });
  it('holds only finite coordinates near Chicago', () => {
    for (const point of file.points) {
      expect(Number.isFinite(point.latitude)).toBe(true);
      expect(Number.isFinite(point.longitude)).toBe(true);
      expect(Math.abs(point.latitude - 41.9)).toBeLessThan(0.5);
      expect(Math.abs(point.longitude + 87.6)).toBeLessThan(0.5);
    }
  });
});
