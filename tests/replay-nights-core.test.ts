import { describe, it, expect } from 'vitest';
import fastCheck from 'fast-check';
import {
  parseCsv,
  cellNumber,
  nightOfSurvey,
  datasetSeason,
  ceilingToLowCloud,
  sliceByTime,
  weatherReading,
  radarReading,
  buildCandidate,
} from '../tools/replay-nights-core.ts';

const SITE = { latitude: 41.8514, longitude: -87.6168 };
const utc = (text) => new Date(text);

describe('parseCsv and cellNumber', () => {
  it('reads a header row and keeps blank cells as empty text', () => {
    const rows = parseCsv('first,second,third\n1,,3\n4,5,6\n\n');
    expect(rows).toEqual([
      { first: '1', second: '', third: '3' },
      { first: '4', second: '5', third: '6' },
    ]);
  });

  it('fills missing trailing cells with empty text', () => {
    expect(parseCsv('first,second\n1')).toEqual([{ first: '1', second: '' }]);
  });

  it('turns blank and bad cells into undefined and keeps real numbers', () => {
    expect(cellNumber('')).toBeUndefined();
    expect(cellNumber('abc')).toBeUndefined();
    expect(cellNumber(undefined)).toBeUndefined();
    expect(cellNumber('0')).toBe(0);
    expect(cellNumber('-3.5')).toBe(-3.5);
  });
});

describe('nightOfSurvey and datasetSeason', () => {
  it('matches a dawn survey to the night before, across month and year ends', () => {
    expect(nightOfSurvey('2018-05-02')).toBe('2018-05-01');
    expect(nightOfSurvey('2018-01-01')).toBe('2017-12-31');
    expect(nightOfSurvey('2020-03-01')).toBe('2020-02-29');
  });

  it('calls days before day 200 spring and the rest fall', () => {
    expect(datasetSeason('2018-01-01')).toBe('spring');
    expect(datasetSeason('2018-07-18')).toBe('spring');
    expect(datasetSeason('2018-07-19')).toBe('fall');
    expect(datasetSeason('2020-07-18')).toBe('fall');
    expect(datasetSeason('2018-12-31')).toBe('fall');
  });
});

describe('ceilingToLowCloud', () => {
  it('counts a ceiling under 1,500 m as low cloud and anything higher as none', () => {
    expect(ceilingToLowCloud(300)).toBe(100);
    expect(ceilingToLowCloud(1499)).toBe(100);
    expect(ceilingToLowCloud(1500)).toBe(0);
    expect(ceilingToLowCloud(22_000)).toBe(0);
  });

  it('gives undefined when the ceiling is unknown', () => {
    expect(ceilingToLowCloud(undefined)).toBeUndefined();
    expect(ceilingToLowCloud(Number.NaN)).toBeUndefined();
  });
});

describe('sliceByTime', () => {
  const readings = [0, 1, 2, 3, 4].map((hour) => ({
    time: utc(`2026-10-16T0${hour}:00:00Z`),
    hour,
  }));

  const plainFilter = (start, end) =>
    readings.filter((entry) => entry.hour >= start && entry.hour <= end);
  it('includes both ends and keeps order', () => {
    const slice = sliceByTime(readings, utc('2026-10-16T01:00:00Z'), utc('2026-10-16T03:00:00Z'));
    expect(slice.map((reading) => reading.hour)).toEqual([1, 2, 3]);
  });

  it('gives an empty list when nothing falls inside', () => {
    expect(sliceByTime(readings, utc('2026-10-17T00:00:00Z'), utc('2026-10-17T05:00:00Z'))).toEqual(
      [],
    );
    expect(sliceByTime([], utc('2026-10-16T00:00:00Z'), utc('2026-10-16T05:00:00Z'))).toEqual([]);
  });

  it('matches a plain filter for any window (property)', () => {
    const hour = fastCheck.integer({ min: 0, max: 4 });
    fastCheck.assert(
      fastCheck.property(hour, hour, (first, second) => {
        const [start, end] = first <= second ? [first, second] : [second, first];
        const slice = sliceByTime(readings, readings[start].time, readings[end].time);
        expect(slice).toEqual(plainFilter(start, end));
      }),
    );
  });
});

describe('weatherReading and radarReading', () => {
  it('leaves out blank fields and turns the ceiling into low cloud', () => {
    const reading = weatherReading({
      time_utc: '2018-05-01T03:53:00Z',
      wind_from_degrees: '',
      wind_speed_mps: '4.1',
      ceiling_m: '600',
      visibility_km: '',
    });
    expect(reading).toEqual({
      time: utc('2018-05-01T03:53:00Z'),
      windSpeedMps: 4.1,
      lowCloudPercent: 100,
    });
  });

  it('reads a radar scan', () => {
    expect(radarReading({ time_utc: '2018-05-01T03:00:00Z', birds_km3: '12.5' })).toEqual({
      time: utc('2018-05-01T03:00:00Z'),
      birdsPerCubicKilometer: 12.5,
    });
  });
});

// Night of 2026-10-16 at the site: sunset about 23:08Z, sunrise about 12:06Z the next day.
const scan = (time, density) => ({ time: utc(time), birdsPerCubicKilometer: density });
const hourly = (time, direction, speed) => ({
  time: utc(time),
  windFromDegrees: direction,
  windSpeedMps: speed,
});

describe('buildCandidate', () => {
  const scans = [
    scan('2026-10-17T00:00:00Z', 10),
    scan('2026-10-17T01:00:00Z', 20),
    scan('2026-10-17T06:00:00Z', 100),
    scan('2026-10-17T11:00:00Z', 40),
    scan('2026-10-18T05:00:00Z', 999),
  ];
  const weather = [
    hourly('2026-10-17T00:53:00Z', 350, 4),
    hourly('2026-10-17T01:53:00Z', 10, 6),
    hourly('2026-10-17T06:53:00Z', 200, 8),
  ];
  const survey = { surveyDate: '2026-10-17', birdsFound: 7, litShare: 0.9 };
  const candidate = buildCandidate(survey, scans, weather, SITE);

  it('matches the survey to the night before and names the season', () => {
    expect(candidate.night).toBe('2026-10-16');
    expect(candidate.season).toBe('fall');
    expect(candidate.birdsFound).toBe(7);
  });

  it('averages radar scans into each part of the night and ignores scans outside it', () => {
    expect(candidate.radar.early.birdsPerCubicKilometer).toBeCloseTo(15, 9);
    expect(candidate.radar.middle.birdsPerCubicKilometer).toBeCloseTo(100, 9);
    expect(candidate.radar.late.birdsPerCubicKilometer).toBeCloseTo(40, 9);
  });

  it('averages weather with a circular mean for wind direction', () => {
    const early = candidate.weather.early;
    expect(Math.min(early.windFromDegrees, 360 - early.windFromDegrees)).toBeCloseTo(0, 6);
    expect(early.windSpeedMps).toBeCloseTo(5, 9);
    expect(candidate.weather.middle.windFromDegrees).toBeCloseTo(200, 6);
    expect(candidate.weather.late).toBeNull();
  });
});
