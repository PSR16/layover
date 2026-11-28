import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';
function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? sourceFiles(join(directory, entry.name)) : [join(directory, entry.name)],
  );
}
describe('map bundle (design section 8)', () => {
  it('imports Leaflet only with a dynamic import, so it stays out of the main chunk', () => {
    const staticImport = (line: string) => line.startsWith('import ') && line.includes("'leaflet");
    const offenders = sourceFiles('src')
      .filter((file) => /\.(ts|css)$/.test(file))
      .filter((file) => readFileSync(file, 'utf8').split('\n').some(staticImport));
    expect(offenders).toEqual([]);
    expect(readFileSync('src/map/load-leaflet.ts', 'utf8')).toContain("import('leaflet')");
  });
});
