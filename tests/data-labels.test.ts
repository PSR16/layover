import { describe, it, expect } from 'vitest';
import { REPLAY_NIGHTS, findReplayNight } from '../src/data/replay-nights.ts';
import { buildCredits } from '../src/lib/credits.ts';
import {
  BADGE_TONES,
  migrationBadge,
  nightBadge,
  riskWord,
  weatherBadge,
} from '../src/lib/data-labels.ts';

describe('nightBadge (R6, R7)', () => {
  it('uses the replay night label for replay records and keeps the tone', () => {
    expect(nightBadge(findReplayNight('radar-2018-05-01'))).toEqual({
      text: 'Replay night, radar-derived migration',
      tone: 'replay',
    });
    expect(nightBadge(findReplayNight('news-2026-10-16'))).toEqual({
      text: 'Replay night, sample migration level',
      tone: 'sample',
    });
  });

  it('says "Sample data" for a record with no source or label', () => {
    for (const record of [
      {},
      { source: 'made-up' },
      { source: undefined, label: '' },
      null,
      undefined,
    ]) {
      expect(nightBadge(record)).toEqual({ text: 'Sample data', tone: 'sample' });
    }
  });

  it('says "Replay night" or "Live data" for a bare record with that source', () => {
    expect(nightBadge({ source: 'replay' })).toEqual({ text: 'Replay night', tone: 'replay' });
    expect(nightBadge({ source: 'live' })).toEqual({ text: 'Live data', tone: 'live' });
  });

  it('gives every saved replay night a label that starts with "Replay night"', () => {
    for (const night of REPLAY_NIGHTS) {
      expect(nightBadge(night).text).toMatch(/^Replay night/);
    }
  });
});

describe('migrationBadge', () => {
  it('marks radar migration as radar-derived and everything else as a sample level', () => {
    expect(migrationBadge({ source: 'replay' }).text).toBe('Radar-derived migration');
    for (const migration of [{ source: 'sample' }, {}, undefined, null, { source: 'live' }]) {
      expect(migrationBadge(migration)).toEqual({ text: 'Sample migration level', tone: 'sample' });
    }
  });
});

describe('weatherBadge (R28, R29)', () => {
  it('names the provider for live weather', () => {
    expect(weatherBadge({ source: 'live', label: 'Weather from weather.gov' })).toEqual({
      text: 'Weather from weather.gov',
      tone: 'live',
    });
  });

  it('says "Saved weather" for a saved snapshot and "Weather unavailable" otherwise', () => {
    expect(weatherBadge({ source: 'saved', label: 'Saved weather' })).toEqual({
      text: 'Saved weather',
      tone: 'notice',
    });
    for (const result of [{ source: 'unavailable' }, {}, undefined, null]) {
      expect(weatherBadge(result)).toEqual({ text: 'Weather unavailable', tone: 'notice' });
    }
  });
});

describe('riskWord', () => {
  it('has a word for each of the three levels and nothing else (product rule)', () => {
    expect(['low', 'elevated', 'high'].map(riskWord)).toEqual(['Low', 'Elevated', 'High']);
    for (const level of ['severe', '', undefined, 'constructor', '__proto__']) {
      expect(() => riskWord(level)).toThrow(TypeError);
    }
  });

  it('only uses tones the badge styles know', () => {
    expect(BADGE_TONES).toEqual(['live', 'replay', 'sample', 'notice']);
  });
});

describe('buildCredits (R36)', () => {
  const attribution = 'Includes data derived from Van Doren et al. (2021), CC BY 4.0.';

  it('credits the dataset only when its attribution is given', () => {
    expect(buildCredits({ datasetAttribution: attribution })).toEqual([
      { id: 'chicago-dataset', text: attribution },
    ]);
    expect(buildCredits({})).toEqual([]);
    expect(buildCredits()).toEqual([]);
    expect(buildCredits({ datasetAttribution: '   ' })).toEqual([]);
  });

  it('credits OpenStreetMap, with a link to its copyright page, only when map data is used', () => {
    const [credit] = buildCredits({ usesMapData: true });
    expect(credit).toEqual({
      id: 'openstreetmap',
      text: '© OpenStreetMap contributors',
      href: 'https://www.openstreetmap.org/copyright',
    });
  });

  it('lists both, dataset first, and gives a new object each time', () => {
    const both = buildCredits({ datasetAttribution: attribution, usesMapData: true });
    expect(both.map((credit) => credit.id)).toEqual(['chicago-dataset', 'openstreetmap']);
    both[1].text = 'changed';
    expect(buildCredits({ usesMapData: true })[0].text).toBe('© OpenStreetMap contributors');
  });
});
describe('building data credits (spec 2 R5)', () => {
  it('names Overture and OpenStreetMap when building data is shown', () => {
    const ids = buildCredits({ usesBuildingData: true }).map((credit) => credit.id);
    expect(ids).toEqual(['overture', 'openstreetmap']);
  });
});
