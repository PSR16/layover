#!/usr/bin/env node
/**
 * Build src/data/radar-nights.json from the tables written by tools/export-chicago-dataset.py.
 *
 *   node tools/build-replay-nights.js --data ~/Documents/Development/layover-data/derived \
 *     --out src/data/radar-nights.json --built-on 2026-11-26
 *
 * The raw dataset stays outside the repo. Only the small chosen-nights file is committed, with the
 * CC BY 4.0 attribution (docs/data-sources.md, requirement R36).
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import { parseArgs } from 'node:util';
import {
  addMigrationLevels,
  buildCandidate,
  cellNumber,
  chooseNights,
  parseCsv,
  radarReading,
  toReplayNight,
  weatherReading,
} from './replay-nights-core.js';

const SITE = {
  name: 'McCormick Place Lakeside Center, Chicago',
  latitude: 41.8514,
  longitude: -87.6168,
};

const ATTRIBUTION =
  'Includes data derived from Van Doren et al. (2021), "Dataset for Drivers of fatal bird collisions in an urban center", ' +
  'Mendeley Data, DOI 10.17632/mjvt3yxdkv.2, licensed CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/). ' +
  'Changes: selected nights, radar bird density converted to a 0 to 1 percentile within season, ' +
  'weather averaged into three night parts. The authors do not endorse Layover.';

const ASSUMPTIONS = [
  'Night of D is sunset on D to sunrise on D+1; the dawn survey on D+1 is matched to it.',
  'Migration is the local radar bird density within 32 km (land and lake), scans with at most half of the area masked as weather, averaged per night part and ranked as a percentile among all nights of the same season (spring means day of year under 200).',
  'Weather is Chicago Midway hourly routine reports averaged per night part. A ceiling under 1,500 m counts as low cloud (100 percent), otherwise 0.',
  'Lit share counts only lighting code YN as lit, weighted by window length.',
  'Counts in "reference" are for checking the engine only. The interface never shows them.',
  'The building was surveyed before its 2024 bird-safe treatment, so these nights describe an untreated building.',
];

function readTable(directory, name) {
  return parseCsv(readFileSync(path.join(directory, name), 'utf8'));
}

function loadInputs(directory) {
  const surveys = readTable(directory, 'collisions_daily.csv').map((row) => ({
    surveyDate: row.survey_date,
    birdsFound: cellNumber(row.total_birds),
    litShare: cellNumber(row.lit_share),
  }));
  const scans = readTable(directory, 'radar_scans.csv').map(radarReading);
  const weather = readTable(directory, 'isd_hourly.csv').map(weatherReading);
  return { surveys, scans, weather };
}

function build(directory, builtOn) {
  const { surveys, scans, weather } = loadInputs(directory);
  const candidates = surveys
    .filter((survey) => survey.litShare !== undefined && survey.birdsFound !== undefined)
    .map((survey) => buildCandidate(survey, scans, weather, SITE));
  const withLevels = addMigrationLevels(candidates);
  return {
    meta: {
      title: 'Radar replay nights from the McCormick Place dataset',
      site: SITE,
      source: 'Van Doren et al. 2021, Mendeley Data, DOI 10.17632/mjvt3yxdkv.2',
      licence: 'CC BY 4.0',
      attribution: ATTRIBUTION,
      builtBy: 'tools/export-chicago-dataset.py and tools/build-replay-nights.js',
      builtOn,
      nightsConsidered: candidates.length,
      assumptions: ASSUMPTIONS,
    },
    nights: chooseNights(withLevels).map(toReplayNight),
  };
}

function main() {
  const { values } = parseArgs({
    options: {
      data: {
        type: 'string',
        default: path.join(homedir(), 'Documents/Development/layover-data/derived'),
      },
      out: { type: 'string', default: 'src/data/radar-nights.json' },
      'built-on': { type: 'string', default: new Date().toISOString().slice(0, 10) },
    },
  });
  const result = build(values.data, values['built-on']);
  writeFileSync(values.out, `${JSON.stringify(result, null, 2)}\n`);
  console.log(
    `Wrote ${result.nights.length} nights (from ${result.meta.nightsConsidered}) to ${values.out}`,
  );
}

main();
