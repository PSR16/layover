/**
 * Everything the night panel shows, worked out as plain data (R6, R9, R24, R27 to R29):
 * the risk level and plain reasons from the engine, the conditions in words, and the badges that
 * say what is sample, replayed, saved or live. No DOM here, so it is easy to test.
 *
 * Risk is only ever Low, Elevated or High. Migration is described in words, never as a count of
 * birds, and nothing here predicts deaths (product rule).
 */
import { assessNight } from './risk.ts';
import { DEFAULT_CONFIG } from './risk-config.ts';
import { migrationBadge, nightBadge, weatherBadge } from './data-labels.ts';
import { migrationLevel } from './risk-inputs.ts';
import type {
  Badge,
  City,
  Migration,
  ReplayNight,
  RiskConfig,
  RiskConfigOverrides,
  RiskLevel,
  WeatherReading,
  WeatherResult,
} from './types.ts';
import { compassPoint } from './wind.ts';

/** One line of the conditions list on the board. */
export interface ConditionRow {
  label: string;
  value: string;
}

/** Everything the night panel shows, as plain data. */
export interface NightModel {
  title: string;
  level: RiskLevel;
  reasons: string[];
  missing: string[];
  rows: ConditionRow[];
  /** The two labels always visible: what kind of night, and where the weather came from. */
  badges: Badge[];
  /** Other labels, shown under the Details control. */
  details: Badge[];
  usesDataset: boolean;
}

interface ModelInput {
  record: ReplayNight | null;
  weatherResult: WeatherResult;
  sampleLevel?: string;
  city?: City;
}

type Part = WeatherReading | null;

/** Sample migration levels offered for tonight (R29). Hand-set, always labelled sample. */
export const SAMPLE_LEVELS: Record<string, { label: string; level: number }> = {
  light: { label: 'Light', level: 0.2 },
  moderate: { label: 'Moderate', level: 0.5 },
  heavy: { label: 'Heavy', level: 0.9 },
};
export const DEFAULT_SAMPLE_LEVEL = 'moderate';

const MISSING_WORDS: Record<string, string> = {
  migration: 'migration',
  wind: 'wind',
  visibility: 'visibility and cloud',
};
const CLEAR_BELOW_PERCENT = 20;

function migrationWords(migration: Migration, config: RiskConfig): string {
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
function shownPart(weather: WeatherResult['weather']): Part {
  return weather?.middle ?? weather?.early ?? weather?.late ?? null;
}

/** A number from a reading, or undefined when it is missing or not finite. */
function readNumber(part: Part, key: keyof WeatherReading): number | undefined {
  const value = part?.[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function windWords(part: Part): string {
  const degrees = readNumber(part, 'windFromDegrees');
  if (degrees === undefined) {
    return 'Not known';
  }
  const speed = readNumber(part, 'windSpeedMps');
  const suffix = speed === undefined ? '' : ` at ${speed.toFixed(1)} m/s`;
  return `From the ${compassPoint(degrees)}${suffix}`;
}

function visibilityWords(part: Part, config: RiskConfig): string {
  const kilometers = readNumber(part, 'visibilityKm');
  if (kilometers === undefined) {
    return 'Not known';
  }
  const low = kilometers < config.lightMultiplier.lowVisibilityBelowKm;
  return `${low ? 'Low' : 'Good'}, ${kilometers.toFixed(0)} km`;
}

function cloudWords(part: Part, config: RiskConfig, notes: string[]): string {
  const isTotalCover = notes.includes('lowCloudFromSkyCover');
  if (isTotalCover) {
    return totalCoverWords(part);
  }
  return lowCloudWords(part, config);
}

/** Forecast cover is total cloud, used as a stand-in for low cloud, so say it in those words. */
function totalCoverWords(part: Part): string {
  const percent = readNumber(part, 'lowCloudPercent');
  if (percent === undefined) {
    return 'Not known';
  }
  const cover = percent < CLEAR_BELOW_PERCENT ? 'Clear' : 'Cloudy';
  return `${cover} (total cover)`;
}

function lowCloudWords(part: Part, config: RiskConfig): string {
  const percent = readNumber(part, 'lowCloudPercent');
  if (percent === undefined) {
    return 'Not known';
  }
  if (percent > config.lightMultiplier.lowCloudAbovePercent) {
    return 'Low cloud';
  }
  return percent < CLEAR_BELOW_PERCENT ? 'Clear' : 'Some cloud';
}

function visibleBadges({ record, weatherResult }: ModelInput): Badge[] {
  const night = record ? nightBadge(record) : nightBadge({ source: 'sample' });
  return [night, weatherBadge(weatherResult)];
}
function detailBadges({
  record,
  migration,
  city,
}: Pick<ModelInput, 'record' | 'city'> & { migration: Migration }): Badge[] {
  const badges: Badge[] = [];
  if (record?.migration?.source !== 'replay') {
    badges.push(migrationBadge(migration));
  }
  if (city?.riskLabel) {
    badges.push({ text: city.riskLabel, tone: 'notice' });
  }
  return badges;
}

function conditionRows({
  migration,
  part,
  weatherResult,
  config,
}: {
  migration: Migration;
  part: Part;
  weatherResult: WeatherResult;
  config: RiskConfig;
}): ConditionRow[] {
  const notes = weatherResult.notes ?? [];
  return [
    { label: 'Migration', value: migrationWords(migration, config) },
    { label: 'Wind', value: windWords(part) },
    { label: 'Visibility', value: visibilityWords(part, config) },
    { label: 'Cloud', value: cloudWords(part, config, notes) },
  ];
}

const TOTAL_COVER_REASON = 'Heavy cloud cover may pull birds toward lit buildings.';

/** Config overrides for this night: the city's own, plus honest wording when cloud is total cover. */
function overridesFor(city: City | undefined, weatherResult: WeatherResult): RiskConfigOverrides {
  const overrides: RiskConfigOverrides = { ...city?.riskOverrides };
  if ((weatherResult.notes ?? []).includes('lowCloudFromSkyCover')) {
    overrides.reasons = { lowCloud: TOTAL_COVER_REASON };
  }
  return overrides;
}

function sampleMigration(sampleLevel: string): Migration {
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
}: ModelInput): NightModel {
  const config = DEFAULT_CONFIG;
  const night = record ? record.night : (weatherResult.night ?? '');
  const migration = record ? record.migration : sampleMigration(sampleLevel);
  const weather = weatherResult.weather;
  const risk = assessNight({ night, migration, weather }, overridesFor(city, weatherResult));
  const part = shownPart(weather);
  return {
    title: record ? `Night of ${night}` : `Tonight, ${night}`,
    level: risk.level,
    reasons: risk.reasons,
    missing: risk.missingInputs.map((name) => MISSING_WORDS[name] ?? name),
    rows: conditionRows({ migration, part, weatherResult, config }),
    badges: visibleBadges({ record, weatherResult }),
    details: detailBadges({ record, migration, city }),
    usesDataset: record?.migration?.source === 'replay',
  };
}
