/**
 * Loads the exported Chicago dataset tables (see tools/export-chicago-dataset.py) and turns them
 * into candidate nights with migration levels. Shared by the replay-night builder and the
 * calibration report. File access happens here; the steps themselves are in replay-nights-core.js.
 */
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import {
  addMigrationLevels,
  buildCandidate,
  cellNumber,
  parseCsv,
  radarReading,
  weatherReading,
} from './replay-nights-core.js';

export const SITE = {
  name: 'McCormick Place Lakeside Center, Chicago',
  latitude: 41.8514,
  longitude: -87.6168,
};

export const DEFAULT_DATA_DIRECTORY = path.join(
  homedir(),
  'Documents/Development/layover-data/derived',
);

function readTable(directory, name) {
  return parseCsv(readFileSync(path.join(directory, name), 'utf8'));
}

export function loadInputs(directory) {
  const surveys = readTable(directory, 'collisions_daily.csv').map((row) => ({
    surveyDate: row.survey_date,
    birdsFound: cellNumber(row.total_birds),
    litShare: cellNumber(row.lit_share),
  }));
  const scans = readTable(directory, 'radar_scans.csv').map(radarReading);
  const weather = readTable(directory, 'isd_hourly.csv').map(weatherReading);
  return { surveys, scans, weather };
}

/** Every survey night with raw radar, weather and a 0 to 1 migration level per night part. */
export function loadCandidates(directory) {
  const { surveys, scans, weather } = loadInputs(directory);
  const candidates = surveys
    .filter((survey) => survey.litShare !== undefined && survey.birdsFound !== undefined)
    .map((survey) => buildCandidate(survey, scans, weather, SITE));
  return addMigrationLevels(candidates);
}
