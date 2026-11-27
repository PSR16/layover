/**
 * Everything the night panel shows, worked out as plain data (R6, R9, R24, R27 to R29):
 * the risk level and plain reasons from the engine, the conditions in words, and the badges that
 * say what is sample, replayed, saved or live. No DOM here, so it is easy to test.
 *
 * Risk is only ever Low, Elevated or High. Migration is described in words, never as a count of
 * birds, and nothing here predicts deaths (product rule).
 */
import { assessNight } from './risk.js';
import { DEFAULT_CONFIG } from './risk-config.js';
import { migrationBadge, nightBadge, weatherBadge } from './data-labels.js';
import { migrationLevel } from './risk-inputs.js';
import { compassPoint } from './wind.js';

/** Sample migration levels offered for tonight (R29). Hand-set, always labelled sample. */
export const SAMPLE_LEVELS = {
  light: { label: 'Light', level: 0.2 },
  moderate: { label: 'Moderate', level: 0.5 },
  heavy: { label: 'Heavy', level: 0.9 },
};
export const DEFAULT_SAMPLE_LEVEL = 'moderate';

const MISSING_WORDS = { migration: 'migration', wind: 'wind', visibility: 'visibility and cloud' };
const CLEAR_BELOW_PERCENT = 20;

function migrationWords(migration, config) {
  const level = migrationLevel(migration, config);
  if (level === undefined) {
    return 'Not known';
  }
  if (level >= config.migrationBands.heavy) {
    return 'Heavy';
  }
  return level >= config.migrationBands.moderate ? 'Moderate' : 'Light';
}

/** The part of the night shown in the rows: the middle, or the first part that has data. */
function shownPart(weather) {
  return weather?.middle ?? weather?.early ?? weather?.late ?? null;
}

function windWords(part) {
  if (!Number.isFinite(part?.windFromDegrees)) {
    return 'Not known';
  }
  const speed = Number.isFinite(part.windSpeedMps) ? ` at ${part.windSpeedMps.toFixed(1)} m/s` : '';
  return `From the ${compassPoint(part.windFromDegrees)}${speed}`;
}

function visibilityWords(part, config) {
  if (!Number.isFinite(part?.visibilityKm)) {
    return 'Not known';
  }
  const low = part.visibilityKm < config.lightMultiplier.lowVisibilityBelowKm;
  return `${low ? 'Low' : 'Good'}, ${part.visibilityKm.toFixed(0)} km`;
}

function cloudWords(part, config) {
  if (!Number.isFinite(part?.lowCloudPercent)) {
    return 'Not known';
  }
  if (part.lowCloudPercent > config.lightMultiplier.lowCloudAbovePercent) {
    return 'Low cloud';
  }
  return part.lowCloudPercent < CLEAR_BELOW_PERCENT ? 'Clear' : 'Some cloud';
}

function nightBadges({ record, weatherResult, migration, city }) {
  const badges = record
    ? [nightBadge(record)]
    : [nightBadge({ source: 'sample' }), { text: 'Tonight', tone: 'live' }];
  if (record?.migration?.source !== 'replay') {
    badges.push(migrationBadge(migration));
  }
  badges.push(weatherBadge(weatherResult));
  if (city?.riskLabel) {
    badges.push({ text: city.riskLabel, tone: 'notice' });
  }
  return badges;
}

function sampleMigration(sampleLevel) {
  const sample = SAMPLE_LEVELS[sampleLevel] ?? SAMPLE_LEVELS[DEFAULT_SAMPLE_LEVEL];
  return { level: sample.level, source: 'sample' };
}

/**
 * @param {object} input
 * @param {object | null} input.record a replay night, or null for tonight
 * @param {object} input.weatherResult a result from the weather client (weather, source, label, night)
 * @param {string} [input.sampleLevel] key of SAMPLE_LEVELS, used for tonight
 * @param {object} input.city the city config (risk overlay and label)
 */
export function buildNightModel({
  record,
  weatherResult,
  sampleLevel = DEFAULT_SAMPLE_LEVEL,
  city,
}) {
  const config = DEFAULT_CONFIG;
  const night = record ? record.night : weatherResult.night;
  const migration = record ? record.migration : sampleMigration(sampleLevel);
  const weather = weatherResult.weather;
  const risk = assessNight({ night, migration, weather }, city?.riskOverrides);
  const part = shownPart(weather);
  return {
    title: record ? `Night of ${night}` : `Tonight, night of ${night}`,
    level: risk.level,
    reasons: risk.reasons,
    missing: risk.missingInputs.map((name) => MISSING_WORDS[name] ?? name),
    rows: [
      { label: 'Migration', value: migrationWords(migration, config) },
      { label: 'Wind', value: windWords(part) },
      { label: 'Visibility', value: visibilityWords(part, config) },
      { label: 'Cloud', value: cloudWords(part, config) },
    ],
    badges: nightBadges({ record, weatherResult, migration, city }),
    usesDataset: record?.migration?.source === 'replay',
  };
}
