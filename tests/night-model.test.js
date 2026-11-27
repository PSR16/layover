import { describe, it, expect } from 'vitest';
import fastCheck from 'fast-check';
import { CHICAGO } from '../src/config/city.js';
import { findReplayNight, REPLAY_NIGHTS } from '../src/data/replay-nights.js';
import { buildNightModel, SAMPLE_LEVELS } from '../src/lib/night-model.js';
import { compassPoint } from '../src/lib/wind.js';

const saved = (record) => ({
  weather: record.weather,
  source: 'saved',
  label: 'Saved weather',
  notes: [],
});
const rough = { windFromDegrees: 200, windSpeedMps: 9, lowCloudPercent: 90, visibilityKm: 3 };
const live = (night, reading = rough) => ({
  night,
  weather: { early: reading, middle: reading, late: reading },
  source: 'live',
  label: 'Weather from weather.gov',
  notes: [],
});
const unavailable = (night) => ({
  night,
  weather: undefined,
  source: 'unavailable',
  label: 'Weather unavailable',
  notes: [],
});
const texts = (badges) => badges.map((badge) => badge.text);

describe('compassPoint', () => {
  it('names the 16 points from degrees, wrapping at north', () => {
    expect([0, 22.5, 90, 180, 270, 337, 359, 360, -10].map(compassPoint)).toEqual([
      'N',
      'NNE',
      'E',
      'S',
      'W',
      'NNW',
      'N',
      'N',
      'N',
    ]);
  });

  it('always returns one of the 16 names (property)', () => {
    fastCheck.assert(
      fastCheck.property(fastCheck.double({ min: -1000, max: 1000, noNaN: true }), (degrees) => {
        expect(compassPoint(degrees)).toMatch(/^[NESW]{1,3}$/);
      }),
    );
  });
});

describe('buildNightModel for a replay night', () => {
  const record = findReplayNight('radar-2018-05-01');
  const model = buildNightModel({ record, weatherResult: saved(record), city: CHICAGO });

  it('gives the level the engine gives with the Chicago overlay (matches the pinned result)', () => {
    expect(model.level).toBe('high');
    expect(model.title).toBe('Night of 2018-05-01');
    expect(model.reasons.length).toBeGreaterThan(0);
  });

  it('labels the night as a radar replay with saved weather and the Chicago label (R6, R28)', () => {
    expect(texts(model.badges)).toEqual([
      'Replay night, radar-derived migration',
      'Saved weather',
      'Chicago lakefront, one site, untreated building',
    ]);
  });

  it('describes conditions in words', () => {
    expect(model.rows.map((row) => row.label)).toEqual([
      'Migration',
      'Wind',
      'Visibility',
      'Cloud',
    ]);
    expect(model.rows[0].value).toBe('Heavy');
    expect(model.rows[1].value).toMatch(/^From the [NESW]{1,3} at \d+\.\d m\/s$/);
  });

  it('flags that the Chicago dataset credit is needed', () => {
    expect(model.usesDataset).toBe(true);
  });

  it('works for every replay night with its saved weather', () => {
    for (const night of REPLAY_NIGHTS) {
      const result = buildNightModel({ record: night, weatherResult: saved(night), city: CHICAGO });
      expect(['low', 'elevated', 'high']).toContain(result.level);
      expect(texts(result.badges)[0]).toMatch(/^Replay night/);
    }
  });
});

describe('buildNightModel for a news night', () => {
  it('shows sample migration level and no dataset credit', () => {
    const record = findReplayNight('news-2026-10-16');
    const model = buildNightModel({ record, weatherResult: saved(record), city: CHICAGO });
    expect(texts(model.badges)).toContain('Replay night, sample migration level');
    expect(texts(model.badges)).toContain('Sample migration level');
    expect(model.usesDataset).toBe(false);
  });
});

describe('buildNightModel for tonight (R29)', () => {
  const base = { record: null, city: CHICAGO };

  it('labels everything as sample or live and names the night', () => {
    const model = buildNightModel({ ...base, weatherResult: live('2026-11-26') });
    expect(model.title).toBe('Tonight, night of 2026-11-26');
    expect(texts(model.badges)).toEqual([
      'Sample data',
      'Tonight',
      'Sample migration level',
      'Weather from weather.gov',
      'Chicago lakefront, one site, untreated building',
    ]);
    expect(model.usesDataset).toBe(false);
  });

  it('follows the chosen sample migration level, from Light to Heavy', () => {
    const levels = ['light', 'moderate', 'heavy'].map(
      (sampleLevel) =>
        buildNightModel({ ...base, weatherResult: live('2026-10-16'), sampleLevel }).rows[0].value,
    );
    expect(levels).toEqual(['Light', 'Moderate', 'Heavy']);
    expect(Object.keys(SAMPLE_LEVELS)).toEqual(['light', 'moderate', 'heavy']);
  });

  it('never rates a light night high, and a heavy rough one above a light one', () => {
    const rank = { low: 0, elevated: 1, high: 2 };
    const level = (sampleLevel) =>
      buildNightModel({ ...base, weatherResult: live('2026-10-16'), sampleLevel }).level;
    expect(level('light')).not.toBe('high');
    expect(rank[level('heavy')]).toBeGreaterThanOrEqual(rank[level('light')]);
  });

  it('says "Weather unavailable", names what is missing and still gives a level (R22, R29)', () => {
    const model = buildNightModel({ ...base, weatherResult: unavailable('2026-11-26') });
    expect(texts(model.badges)).toContain('Weather unavailable');
    expect(model.missing).toEqual(['visibility and cloud', 'wind']);
    expect(['low', 'elevated', 'high']).toContain(model.level);
    expect(model.rows.slice(1).map((row) => row.value)).toEqual([
      'Not known',
      'Not known',
      'Not known',
    ]);
  });

  it('falls back to the default sample level for an unknown choice', () => {
    const model = buildNightModel({
      ...base,
      weatherResult: live('2026-10-16'),
      sampleLevel: 'enormous',
    });
    expect(model.rows[0].value).toBe('Moderate');
  });
});

describe('what the panel never shows (product rule)', () => {
  it('uses no bird counts or casualty words in reasons, rows or badges', () => {
    for (const night of REPLAY_NIGHTS) {
      const model = buildNightModel({ record: night, weatherResult: saved(night), city: CHICAGO });
      const words = [
        ...model.reasons,
        ...texts(model.badges),
        ...model.rows.map((row) => row.value),
      ].join(' ');
      expect(words).not.toMatch(/\b(dead|death|died|kill|casualt|fatal)/i);
      expect(model.reasons.join(' ')).not.toMatch(/\d/);
    }
  });
});
