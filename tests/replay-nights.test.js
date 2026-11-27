import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import { REPLAY_NIGHTS, RADAR_ATTRIBUTION, findReplayNight } from '../src/data/replay-nights.js';
import { DATA_SOURCES, effectiveSource } from '../src/lib/data-source.js';
import { conditionsFromReplay } from '../src/lib/replay-conditions.js';
import { normalizeOpenMeteo } from '../src/lib/weather-normalize.js';
import { assessNight } from '../src/lib/risk.js';

const PARTS = ['early', 'middle', 'late'];
const CHICAGO = { latitude: 41.88, longitude: -87.63 };
const withoutReference = (night) =>
  Object.fromEntries(Object.entries(night).filter(([key]) => key !== 'reference'));
const radarNights = REPLAY_NIGHTS.filter((night) => night.source === 'replay');
const newsNights = REPLAY_NIGHTS.filter((night) => night.kind === 'news-event');

describe('effectiveSource (R7)', () => {
  it('keeps the three known sources', () => {
    for (const source of DATA_SOURCES) {
      expect(effectiveSource({ source })).toBe(source);
    }
  });

  it('treats a missing, empty or unknown source as sample', () => {
    for (const record of [
      {},
      { source: undefined },
      { source: '' },
      { source: 'real' },
      null,
      undefined,
    ]) {
      expect(effectiveSource(record)).toBe('sample');
    }
  });
});

describe('REPLAY_NIGHTS records (R6, R7, R26, R28)', () => {
  it('has 16 radar nights and 2 news nights in date order with unique ids', () => {
    expect(radarNights).toHaveLength(16);
    expect(newsNights).toHaveLength(2);
    const dates = REPLAY_NIGHTS.map((night) => night.night);
    expect(dates).toEqual([...dates].sort());
    expect(new Set(REPLAY_NIGHTS.map((night) => night.id)).size).toBe(REPLAY_NIGHTS.length);
  });

  it('gives every record a known source, a visible label and a note on where it came from', () => {
    for (const night of REPLAY_NIGHTS) {
      expect(DATA_SOURCES).toContain(night.source);
      expect(night.source).toBe(effectiveSource(night));
      expect(night.label).toMatch(/^Replay night/);
      expect(night.note.length).toBeGreaterThan(20);
      expect(night.night).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(['spring', 'fall']).toContain(night.season);
    }
  });

  it('labels radar nights as replay and news nights as sample migration level (R26)', () => {
    for (const night of radarNights) {
      expect(night.migration.source).toBe('replay');
      expect(night.label).toBe('Replay night, radar-derived migration');
    }
    for (const night of newsNights) {
      expect(night.source).toBe('sample');
      expect(night.migration.source).toBe('sample');
      expect(night.label).toBe('Replay night, sample migration level');
      expect(night.migration.level).toBeGreaterThan(0.9);
    }
  });

  it('carries a saved weather snapshot with a source and date for every night (R28)', () => {
    for (const night of REPLAY_NIGHTS) {
      expect(night.weatherSource.length).toBeGreaterThan(5);
      expect(night.weatherSavedOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      const present = PARTS.filter((part) => night.weather[part] !== null);
      expect(present.length).toBeGreaterThanOrEqual(2);
      for (const part of present) {
        expect(Object.values(night.weather[part]).every(Number.isFinite)).toBe(true);
      }
    }
  });

  it('keeps survey counts out of every field except the reference block', () => {
    for (const night of REPLAY_NIGHTS) {
      expect(JSON.stringify(withoutReference(night))).not.toMatch(/birdsFound/);
    }
  });

  it('links the news nights to a report, and the 2026 night to the regional dashboard', () => {
    expect(findReplayNight('news-2026-10-16').links.migrationDashboard).toBe(
      'https://dashboard.birdcast.org/region/US-IL-031?night=2026-10-16',
    );
    for (const night of newsNights) {
      expect(night.links.report).toMatch(/^https:\/\//);
    }
  });

  it('exposes the dataset attribution for the credits (R36)', () => {
    expect(RADAR_ATTRIBUTION).toContain('10.17632/mjvt3yxdkv.2');
    expect(RADAR_ATTRIBUTION).toContain('CC BY 4.0');
  });

  it('finds a night by id and gives undefined for an unknown id', () => {
    expect(findReplayNight('radar-2018-05-01').night).toBe('2018-05-01');
    expect(findReplayNight('nope')).toBeUndefined();
  });
});

describe('saved news weather matches the Task 8 fixture', () => {
  it('has the same night-part averages as the saved Open-Meteo response for 2026-10-16', () => {
    const raw = JSON.parse(
      readFileSync(
        new URL('./fixtures/open-meteo-chicago-2026-10-16.json', import.meta.url),
        'utf8',
      ),
    );
    const { weather } = normalizeOpenMeteo(raw, '2026-10-16', CHICAGO);
    const saved = findReplayNight('news-2026-10-16').weather;
    for (const part of PARTS) {
      expect(saved[part].windFromDegrees).toBeCloseTo(weather[part].windFromDegrees, 1);
      expect(saved[part].windSpeedMps).toBeCloseTo(weather[part].windSpeedMps, 1);
      expect(saved[part].visibilityKm).toBeCloseTo(weather[part].visibilityKm, 1);
    }
  });
});

describe('conditionsFromReplay', () => {
  const record = findReplayNight('radar-2018-05-01');

  it('gives the engine only the night, migration and weather', () => {
    const conditions = conditionsFromReplay(record);
    expect(Object.keys(conditions).sort()).toEqual(['migration', 'night', 'weather']);
    expect(JSON.stringify(conditions)).not.toMatch(/birdsFound|note|label/);
  });

  it('copies the values so the engine cannot change the saved record', () => {
    const conditions = conditionsFromReplay(record);
    conditions.migration.middle = 0;
    conditions.weather.middle.windSpeedMps = -1;
    expect(record.migration.middle).toBeGreaterThan(0.5);
    expect(record.weather.middle.windSpeedMps).toBeGreaterThan(0);
  });

  it('is accepted by the risk engine for every replay night', () => {
    for (const night of REPLAY_NIGHTS) {
      const result = assessNight(conditionsFromReplay(night));
      expect(['low', 'elevated', 'high']).toContain(result.level);
      expect(result.reasons.length).toBeGreaterThan(0);
    }
  });
});
