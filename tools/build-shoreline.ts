#!/usr/bin/env node
/**
 * Build src/data/chicago-shoreline.json (spec 2 R15): the Lake Michigan shore from OpenStreetMap
 * near Chicago and Evanston, joined into one line and simplified to at most 200 points.
 *
 *   npx vite-node tools/build-shoreline.ts --built-on 2026-11-27
 *   npx vite-node tools/build-shoreline.ts --input ~/Documents/Development/layover-data/overpass/lake-michigan-ways.json
 *
 * Without --input it asks Overpass (a build-time request, not part of the app) and saves the raw
 * answer outside the repo. The public server is often busy, so it retries a few times.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { parseArgs } from 'node:util';
import { longestChain, simplifyToMaxPoints, toCoordinates, type OsmWay } from './shoreline-core.ts';
const MAX_POINTS = 200;
const BBOX = { south: 41.7, west: -87.8, north: 42.08, east: -87.5 };
const ENDPOINT = 'https://overpass-api.de/api/interpreter';
const RAW_PATH = join(
  homedir(),
  'Documents/Development/layover-data/overpass/lake-michigan-ways.json',
);
const ATTRIBUTION = '© OpenStreetMap contributors (ODbL 1.0)';
const RETRIES = 4;
const RETRY_WAIT_MS = 15_000;
const QUERY =
  '[out:json][timeout:90];rel["natural"="water"]["name"="Lake Michigan"];' +
  `way(r)(${BBOX.south},${BBOX.west},${BBOX.north},${BBOX.east});out geom;`;
const pause = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));
async function askOverpass(): Promise<OsmWay[]> {
  for (let attempt = 1; attempt <= RETRIES; attempt += 1) {
    const response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'User-Agent': 'layover-build/0.1 (one-off shoreline build)',
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: `data=${encodeURIComponent(QUERY)}`,
    });
    const text = await response.text();
    if (response.ok && text.startsWith('{')) {
      mkdirSync(dirname(RAW_PATH), { recursive: true });
      writeFileSync(RAW_PATH, text);
      return (JSON.parse(text) as { elements: OsmWay[] }).elements;
    }
    console.log(`Overpass try ${attempt} of ${RETRIES} failed (${response.status}). Waiting.`);
    await pause(RETRY_WAIT_MS * attempt);
  }
  throw new Error('Overpass did not answer. Try again later or pass --input with a saved answer.');
}
async function main() {
  const { values } = parseArgs({
    options: {
      input: { type: 'string' },
      out: { type: 'string', default: 'src/data/chicago-shoreline.json' },
      'built-on': { type: 'string', default: new Date().toISOString().slice(0, 10) },
    },
  });
  const ways = values.input
    ? (JSON.parse(readFileSync(values.input, 'utf8')) as { elements: OsmWay[] }).elements
    : await askOverpass();
  const chain = longestChain(ways);
  if (!chain) {
    throw new Error('No single shoreline line found in the answer.');
  }
  const points = toCoordinates(simplifyToMaxPoints(chain, MAX_POINTS));
  const header = {
    title: 'Lake Michigan shoreline near Chicago and Evanston',
    source: 'OpenStreetMap, relation "Lake Michigan", member ways inside the box',
    bbox: [BBOX.west, BBOX.south, BBOX.east, BBOX.north],
    licence: 'ODbL 1.0',
    attribution: ATTRIBUTION,
    builtBy: 'tools/build-shoreline.ts',
    builtOn: values['built-on'],
    note: 'Open water edge only. Small harbour and pier pieces that do not join the main line are left out.',
    pointsBefore: chain.length,
    pointsAfter: points.length,
  };
  writeFileSync(values.out, `${JSON.stringify({ header, points })}\n`);
  console.log(`Wrote ${points.length} points (from ${chain.length}) to ${values.out}`);
}
await main();
