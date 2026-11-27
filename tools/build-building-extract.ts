#!/usr/bin/env node
/**
 * Build the static building extract (spec 2 R1, R2) from the Overture downloads.
 *
 *   npx vite-node tools/build-building-extract.ts --built-on 2026-11-27 \
 *     --data ~/Documents/Development/layover-data/overture --out src/data
 *
 * Writes src/data/buildings-<area>.json for the loop, lakefront and evanston areas, each with a
 * header that names the Overture release, the build date and this script. Prints how many
 * buildings each rule dropped and the gzipped size, and fails when the total is over the budget.
 * The raw downloads stay outside the repo.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { gzipSync } from 'node:zlib';
import { DEFAULT_RULES, selectBuildings, type OvertureFeature } from './extract-records.ts';
const AREAS = ['loop', 'lakefront', 'evanston'];
const BUDGET_GZIP_BYTES = 500_000;
const DEFAULT_DATA = join(homedir(), 'Documents/Development/layover-data/overture');
const ATTRIBUTION =
  'Building data from Overture Maps Foundation (buildings theme, ODbL 1.0), which includes ' +
  '© OpenStreetMap contributors, Microsoft ML Buildings and USGS Lidar heights.';
interface AreaState {
  last_release: string;
  bbox: { xmin: number; ymin: number; xmax: number; ymax: number };
}
function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, 'utf8')) as T;
}
function buildArea(directory: string, area: string, builtOn: string) {
  const state = readJson<AreaState>(join(directory, `${area}.geojson.state`));
  const collection = readJson<{ features: OvertureFeature[] }>(join(directory, `${area}.geojson`));
  const { buildings, dropped } = selectBuildings(collection.features, DEFAULT_RULES);
  const header = {
    title: `Buildings, ${area} study area`,
    area,
    bbox: [state.bbox.xmin, state.bbox.ymin, state.bbox.xmax, state.bbox.ymax],
    overtureRelease: state.last_release,
    licence: 'ODbL 1.0',
    attribution: ATTRIBUTION,
    builtBy: 'tools/build-building-extract.ts',
    builtOn,
    rules: DEFAULT_RULES,
    counts: { considered: collection.features.length, kept: buildings.length, dropped },
  };
  return { header, buildings };
}
function main() {
  const { values } = parseArgs({
    options: {
      data: { type: 'string', default: DEFAULT_DATA },
      out: { type: 'string', default: 'src/data' },
      'built-on': { type: 'string', default: new Date().toISOString().slice(0, 10) },
      'dry-run': { type: 'boolean', default: false },
    },
  });
  let totalGzip = 0;
  for (const area of AREAS) {
    const result = buildArea(values.data, area, values['built-on']);
    const text = `${JSON.stringify(result)}\n`;
    const gzipBytes = gzipSync(text).length;
    totalGzip += gzipBytes;
    const { counts } = result.header;
    console.log(
      `${area}: kept ${counts.kept} of ${counts.considered} (dropped ${JSON.stringify(counts.dropped)}), ` +
        `${text.length} bytes, ${gzipBytes} gzipped`,
    );
    if (!values['dry-run']) {
      writeFileSync(join(values.out, `buildings-${area}.json`), text);
    }
  }
  console.log(`Total ${totalGzip} bytes gzipped (budget ${BUDGET_GZIP_BYTES}).`);
  if (totalGzip > BUDGET_GZIP_BYTES) {
    console.error(
      'Over the size budget. Nothing more is dropped automatically: decide what to cut.',
    );
    process.exitCode = 1;
  }
}
main();
