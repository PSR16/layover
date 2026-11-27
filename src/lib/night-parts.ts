/**
 * Split a night into early, middle and late thirds by elapsed time between sunset and sunrise,
 * and average readings inside each part. Same method as Van Doren et al. 2021 (E1);
 * the middle third was the most informative for migration and weather.
 */
import type { NightPartName } from './types.ts';
import { circularMeanDegrees } from './wind.ts';

/** A moment: a Date, a timestamp in milliseconds or a date string. */
export type TimeLike = Date | number | string;

/** A timed reading with any number of numeric fields (wind, cloud, radar density, ...). */
export interface Reading {
  time: TimeLike;
}

/** Averages of the numeric fields of some readings. */
export type Averages = Record<string, number>;

const PART_NAMES: readonly NightPartName[] = ['early', 'middle', 'late'];
const PART_COUNT = PART_NAMES.length;
const DIRECTION_FIELDS = new Set(['windFromDegrees']);

/**
 * Which part of the night a moment falls in.
 * @returns {'early' | 'middle' | 'late' | null} null outside sunset to sunrise
 */
export function getNightPart(
  time: TimeLike,
  sunset: TimeLike,
  sunrise: TimeLike,
): NightPartName | null {
  const start = new Date(sunset).getTime();
  const length = new Date(sunrise).getTime() - start;
  const progress = (new Date(time).getTime() - start) / length;
  const isInsideNight = length > 0 && progress >= 0 && progress <= 1;
  if (!isInsideNight) {
    return null;
  }
  const index = Math.min(Math.floor(progress * PART_COUNT), PART_COUNT - 1);
  return PART_NAMES[index];
}

/** Group readings ({ time, ...fields }) by night part. Readings outside the night are dropped. */
export function splitIntoNightParts<T extends Reading>(
  readings: T[],
  sunset: TimeLike,
  sunrise: TimeLike,
): Record<NightPartName, T[]> {
  const parts: Record<NightPartName, T[]> = { early: [], middle: [], late: [] };
  for (const reading of readings) {
    const part = getNightPart(reading.time, sunset, sunrise);
    if (part) {
      parts[part].push(reading);
    }
  }
  return parts;
}

function collectValues(readings: Reading[], field: string): number[] {
  return readings
    .map((reading) => (reading as unknown as Record<string, unknown>)[field])
    .filter((value): value is number => Number.isFinite(value));
}

function averageField(readings: Reading[], field: string): number | null {
  const values = collectValues(readings, field);
  if (values.length === 0) {
    return null;
  }
  if (DIRECTION_FIELDS.has(field)) {
    return circularMeanDegrees(values);
  }
  return values.reduce((total, value) => total + value, 0) / values.length;
}

/**
 * Average the readings of one part. Wind direction uses a circular mean.
 * Fields with no usable value are left out. An empty list gives an empty object.
 */
export function averageReadings(readings: Reading[]): Averages {
  const fields = new Set(readings.flatMap((reading) => Object.keys(reading)));
  fields.delete('time');
  const averages: Averages = {};
  for (const field of fields) {
    const average = averageField(readings, field);
    if (average !== null) {
      averages[field] = average;
    }
  }
  return averages;
}

/**
 * Summarize a night: one object of averages per part, or null for a part with no readings.
 * @returns {{ early: object | null, middle: object | null, late: object | null }}
 */
export function summarizeNight(
  readings: Reading[],
  sunset: TimeLike,
  sunrise: TimeLike,
): Record<NightPartName, Averages | null> {
  const parts = splitIntoNightParts(readings, sunset, sunrise);
  const summary: Record<NightPartName, Averages | null> = { early: null, middle: null, late: null };
  for (const name of PART_NAMES) {
    summary[name] = parts[name].length > 0 ? averageReadings(parts[name]) : null;
  }
  return summary;
}
