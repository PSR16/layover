import { describe, it, expect } from 'vitest';
import fastCheck from 'fast-check';
import {
  getNightPart,
  splitIntoNightParts,
  averageReadings,
  summarizeNight,
} from '../src/lib/night-parts.js';

const SUNSET = new Date('2026-10-17T23:00:00Z');
const SUNRISE = new Date('2026-10-18T11:00:00Z'); // 12 hours, so each part is 4 hours
const hoursAfterSunset = (hours) => new Date(SUNSET.getTime() + hours * 3_600_000);

const readingAtMinute = (minutes) => ({
  time: new Date(SUNSET.getTime() + minutes * 60_000),
  windSpeedMps: 1,
});
const isDuringNight = (minutes) => minutes >= 0 && minutes <= 720;

describe('getNightPart', () => {
  it('puts times in early, middle and late thirds', () => {
    expect(getNightPart(hoursAfterSunset(1), SUNSET, SUNRISE)).toBe('early');
    expect(getNightPart(hoursAfterSunset(6), SUNSET, SUNRISE)).toBe('middle');
    expect(getNightPart(hoursAfterSunset(11), SUNSET, SUNRISE)).toBe('late');
  });

  it('assigns the boundaries to the later part and the ends to the first and last parts', () => {
    expect(getNightPart(SUNSET, SUNSET, SUNRISE)).toBe('early');
    expect(getNightPart(hoursAfterSunset(4), SUNSET, SUNRISE)).toBe('middle');
    expect(getNightPart(hoursAfterSunset(8), SUNSET, SUNRISE)).toBe('late');
    expect(getNightPart(SUNRISE, SUNSET, SUNRISE)).toBe('late');
  });

  it('returns null outside the night or for a bad night length', () => {
    expect(getNightPart(hoursAfterSunset(-1), SUNSET, SUNRISE)).toBeNull();
    expect(getNightPart(hoursAfterSunset(13), SUNSET, SUNRISE)).toBeNull();
    expect(getNightPart(SUNSET, SUNRISE, SUNSET)).toBeNull();
    expect(getNightPart('not a date', SUNSET, SUNRISE)).toBeNull();
  });
});

describe('splitIntoNightParts', () => {
  it('keeps every reading that falls in the night, exactly once', () => {
    const minutesAfterSunset = fastCheck.integer({ min: -300, max: 1020 });
    fastCheck.assert(
      fastCheck.property(fastCheck.array(minutesAfterSunset), (offsets) => {
        const readings = offsets.map(readingAtMinute);
        const parts = splitIntoNightParts(readings, SUNSET, SUNRISE);
        const kept = parts.early.length + parts.middle.length + parts.late.length;
        expect(kept).toBe(offsets.filter(isDuringNight).length);
      }),
    );
  });
});

describe('averageReadings', () => {
  it('averages numbers and uses a circular mean for wind direction', () => {
    const result = averageReadings([
      { time: SUNSET, windFromDegrees: 350, windSpeedMps: 4 },
      { time: SUNSET, windFromDegrees: 10, windSpeedMps: 8 },
    ]);
    expect(result.windSpeedMps).toBe(6);
    expect(Math.min(result.windFromDegrees, 360 - result.windFromDegrees)).toBeCloseTo(0, 6);
  });

  it('skips missing values and leaves out fields with no data', () => {
    const result = averageReadings([
      { time: SUNSET, visibilityKm: 4, lowCloudPercent: undefined },
      { time: SUNSET, visibilityKm: Number.NaN, lowCloudPercent: null },
    ]);
    expect(result).toEqual({ visibilityKm: 4 });
  });

  it('gives an empty object for no readings', () => {
    expect(averageReadings([])).toEqual({});
  });
});

describe('summarizeNight', () => {
  it('summarizes each part and gives null for a part with no readings', () => {
    const readings = [
      { time: hoursAfterSunset(1), visibilityKm: 10 },
      { time: hoursAfterSunset(2), visibilityKm: 6 },
      { time: hoursAfterSunset(9), visibilityKm: 2 },
    ];
    const summary = summarizeNight(readings, SUNSET, SUNRISE);
    expect(summary.early).toEqual({ visibilityKm: 8 });
    expect(summary.middle).toBeNull();
    expect(summary.late).toEqual({ visibilityKm: 2 });
  });
});
