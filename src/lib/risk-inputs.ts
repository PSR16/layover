/**
 * Helpers that read a night's conditions for the risk factors: night parts, season,
 * wind and sky scores. Pure logic. Every score is a share from 0 to 1, or undefined
 * when the input is missing (missing is not the same as zero, R22).
 */
import { findSeason } from './season.ts';
import type {
  Migration,
  NightPartName,
  NightWeather,
  RiskConfig,
  Season,
  WeatherReading,
} from './types.ts';
import { isInAnySector, isWesterly, turnedUnfavorable } from './wind.ts';

const PARTS: readonly NightPartName[] = ['early', 'middle', 'late'];

/** A value (or nothing) for each part of the night. */
type PartValues<T> = Record<NightPartName, T | undefined>;

/** Shares from 0 to 1 for one night's weather, each undefined when not measured. */
export interface WeatherSummary {
  wind: number | undefined;
  lowVisibility: number | undefined;
  lowCloud: number | undefined;
  sky: number | undefined;
  windShift: number | undefined;
}

function isFiniteNumber(value: unknown): value is number {
  return Number.isFinite(value);
}

function emptyParts<T>(): PartValues<T> {
  return { early: undefined, middle: undefined, late: undefined };
}

function valueForPart(
  source: Record<string, unknown>,
  part: NightPartName,
  hasParts: boolean,
  singleKey: string | undefined,
): unknown {
  if (hasParts) {
    return source[part];
  }
  return singleKey ? source[singleKey] : source;
}

/** Give each night part a value. A single whole-night value is used for all parts (R37). */
function expandToParts<T>(input: unknown, singleKey?: string): PartValues<T> {
  if (!input || typeof input !== 'object') {
    return emptyParts<T>();
  }
  const source = input as Record<string, unknown>;
  const hasParts = PARTS.some((part) => part in source);
  const parts = emptyParts<T>();
  for (const part of PARTS) {
    parts[part] = valueForPart(source, part, hasParts, singleKey) as T | undefined;
  }
  return parts;
}

/** Weighted average over the parts that have a value; undefined when none do (R37). */
export function combineParts(
  valueByPart: Partial<Record<NightPartName, number | null | undefined>>,
  config: RiskConfig,
): number | undefined {
  let total = 0;
  let weightSum = 0;
  for (const part of PARTS) {
    const value = valueByPart[part];
    if (isFiniteNumber(value)) {
      total += value * config.nightParts[part];
      weightSum += config.nightParts[part];
    }
  }
  return weightSum > 0 ? total / weightSum : undefined;
}

/** Migration level (0 to 1) for a night, weighted over its parts. */
export function migrationLevel(
  migration: Migration | null | undefined,
  config: RiskConfig,
): number | undefined {
  const byPart = expandToParts<number>(migration, 'level');
  return combineParts(byPart, config);
}

/** Weather points grow with migration. No migration data counts as full scale (cautious). */
export function weatherScale(level: number | undefined, config: RiskConfig): number {
  if (!isFiniteNumber(level)) {
    return 1;
  }
  const { minimum } = config.weatherScaling;
  return minimum + (1 - minimum) * Math.min(Math.max(level, 0), 1);
}

export function seasonOf(night: string, config: RiskConfig): Season | null {
  return findSeason(night, config.seasons);
}

type Reading = WeatherReading | null | undefined;

function windScoreOfReading(
  reading: Reading,
  season: Season | null,
  config: RiskConfig,
): number | undefined {
  if (!season) {
    return 0;
  }
  if (!isFiniteNumber(reading?.windFromDegrees)) {
    return undefined;
  }
  if (!isInAnySector(reading.windFromDegrees, config.wind[season].unfavorableFrom)) {
    return 0;
  }
  const strong = (reading.windSpeedMps ?? Number.NaN) >= config.wind.strongMps;
  return strong ? 1 : config.wind.lightWindFactor;
}

function lowVisibilityOfReading(reading: Reading, config: RiskConfig): number | undefined {
  if (!isFiniteNumber(reading?.visibilityKm)) {
    return undefined;
  }
  return reading.visibilityKm < config.lightMultiplier.lowVisibilityBelowKm ? 1 : 0;
}

function lowCloudOfReading(reading: Reading, config: RiskConfig): number | undefined {
  if (!isFiniteNumber(reading?.lowCloudPercent)) {
    return undefined;
  }
  return reading.lowCloudPercent > config.lightMultiplier.lowCloudAbovePercent ? 1 : 0;
}

function worstOf(first: number | undefined, second: number | undefined): number | undefined {
  const known = [first, second].filter(isFiniteNumber);
  return known.length > 0 ? Math.max(...known) : undefined;
}

function scoreByPart(
  readings: PartValues<WeatherReading>,
  scoreOfReading: (reading: Reading) => number | undefined,
): PartValues<number> {
  return {
    early: scoreOfReading(readings.early),
    middle: scoreOfReading(readings.middle),
    late: scoreOfReading(readings.late),
  };
}

/**
 * Summarize one night's weather as shares from 0 to 1 (undefined when not measured):
 * wind, lowVisibility, lowCloud, sky (worst of visibility and cloud) and windShift.
 */
export function summarizeWeather(
  weather: NightWeather | null | undefined,
  season: Season | null,
  config: RiskConfig,
): WeatherSummary {
  const readings = expandToParts<WeatherReading>(weather);
  const weighted = (scoreOfReading: (reading: Reading) => number | undefined) =>
    combineParts(scoreByPart(readings, scoreOfReading), config);
  const lowVisibility = weighted((reading) => lowVisibilityOfReading(reading, config));
  const lowCloud = weighted((reading) => lowCloudOfReading(reading, config));
  return {
    wind: weighted((reading) => windScoreOfReading(reading, season, config)),
    lowVisibility,
    lowCloud,
    sky: worstOf(lowVisibility, lowCloud),
    windShift: windShiftOf(readings, season, config),
  };
}

/** 1 when wind turns from favorable to unfavorable between early and late, else 0 (R17, E4). */
function windShiftOf(
  readings: PartValues<WeatherReading>,
  season: Season | null,
  config: RiskConfig,
): number | undefined {
  const early = readings.early?.windFromDegrees;
  const late = readings.late?.windFromDegrees;
  if (!season || !isFiniteNumber(early) || !isFiniteNumber(late)) {
    return undefined;
  }
  return turnedUnfavorable(early, late, config.wind[season].unfavorableFrom) ? 1 : 0;
}

/** Share of the night with wind from the west (1 = all parts, 0 = none, undefined = no data). */
export function westerlyShare(
  weather: NightWeather | null | undefined,
  config: RiskConfig,
): number | undefined {
  const readings = expandToParts<WeatherReading>(weather);
  const byPart = scoreByPart(readings, (reading) =>
    isFiniteNumber(reading?.windFromDegrees)
      ? Number(isWesterly(reading.windFromDegrees))
      : undefined,
  );
  return combineParts(byPart, config);
}
