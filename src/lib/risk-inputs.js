/**
 * Helpers that read a night's conditions for the risk factors: night parts, season,
 * wind and sky scores. Pure logic. Every score is a share from 0 to 1, or undefined
 * when the input is missing (missing is not the same as zero, R22).
 */
import { findSeason } from './season.js';
import { isInAnySector, isWesterly, turnedUnfavorable } from './wind.js';

const PARTS = ['early', 'middle', 'late'];

function isFiniteNumber(value) {
  return Number.isFinite(value);
}

/** Give each night part a value. A single whole-night value is used for all parts (R37). */
function expandToParts(input, singleKey) {
  if (!input || typeof input !== 'object') {
    return {};
  }
  const hasParts = PARTS.some((part) => part in input);
  if (hasParts) {
    return Object.fromEntries(PARTS.map((part) => [part, input[part]]));
  }
  return Object.fromEntries(PARTS.map((part) => [part, singleKey ? input[singleKey] : input]));
}

/** Weighted average over the parts that have a value; undefined when none do (R37). */
export function combineParts(valueByPart, config) {
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
export function migrationLevel(migration, config) {
  const byPart = expandToParts(migration, 'level');
  return combineParts(byPart, config);
}

/** Weather points grow with migration. No migration data counts as full scale (cautious). */
export function weatherScale(level, config) {
  if (!isFiniteNumber(level)) {
    return 1;
  }
  const { minimum } = config.weatherScaling;
  return minimum + (1 - minimum) * Math.min(Math.max(level, 0), 1);
}

export function seasonOf(night, config) {
  return findSeason(night, config.seasons);
}

function windScoreOfReading(reading, season, config) {
  if (!season) {
    return 0;
  }
  if (!isFiniteNumber(reading?.windFromDegrees)) {
    return undefined;
  }
  if (!isInAnySector(reading.windFromDegrees, config.wind[season].unfavorableFrom)) {
    return 0;
  }
  const strong = reading.windSpeedMps >= config.wind.strongMps;
  return strong ? 1 : config.wind.lightWindFactor;
}

function lowVisibilityOfReading(reading, config) {
  if (!isFiniteNumber(reading?.visibilityKm)) {
    return undefined;
  }
  return reading.visibilityKm < config.lightMultiplier.lowVisibilityBelowKm ? 1 : 0;
}

function lowCloudOfReading(reading, config) {
  if (!isFiniteNumber(reading?.lowCloudPercent)) {
    return undefined;
  }
  return reading.lowCloudPercent > config.lightMultiplier.lowCloudAbovePercent ? 1 : 0;
}

function worstOf(first, second) {
  const known = [first, second].filter(isFiniteNumber);
  return known.length > 0 ? Math.max(...known) : undefined;
}

function scoreByPart(readings, scoreOfReading) {
  return Object.fromEntries(PARTS.map((part) => [part, scoreOfReading(readings[part])]));
}

/**
 * Summarize one night's weather as shares from 0 to 1 (undefined when not measured):
 * wind, lowVisibility, lowCloud, sky (worst of visibility and cloud) and windShift.
 */
export function summarizeWeather(weather, season, config) {
  const readings = expandToParts(weather);
  const weighted = (scoreOfReading) => combineParts(scoreByPart(readings, scoreOfReading), config);
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
function windShiftOf(readings, season, config) {
  const early = readings.early?.windFromDegrees;
  const late = readings.late?.windFromDegrees;
  if (!season || !isFiniteNumber(early) || !isFiniteNumber(late)) {
    return undefined;
  }
  return turnedUnfavorable(early, late, config.wind[season].unfavorableFrom) ? 1 : 0;
}

/** Share of the night with wind from the west (1 = all parts, 0 = none, undefined = no data). */
export function westerlyShare(weather, config) {
  const readings = expandToParts(weather);
  const byPart = scoreByPart(readings, (reading) =>
    isFiniteNumber(reading?.windFromDegrees)
      ? Number(isWesterly(reading.windFromDegrees))
      : undefined,
  );
  return combineParts(byPart, config);
}
