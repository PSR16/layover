import { describe, it, expect } from 'vitest';
import radarNights from '../src/data/radar-nights.json';
import { nightOfSurvey } from '../tools/replay-nights-core.ts';

const { meta, nights } = radarNights;
const PARTS = ['early', 'middle', 'late'];
const byKind = (kind) => nights.filter((night) => night.kind === kind);
const median = (values) =>
  [...values].sort((first, second) => first - second)[Math.floor(values.length / 2)];
const middleLevels = (list) => list.map((night) => night.migration.middle);

describe('radar-nights.json meta (R36)', () => {
  it('carries the dataset attribution, licence and DOI', () => {
    expect(meta.licence).toBe('CC BY 4.0');
    expect(meta.attribution).toContain('10.17632/mjvt3yxdkv.2');
    expect(meta.attribution).toContain('CC BY 4.0');
    expect(meta.attribution).toContain('do not endorse');
    expect(meta.builtBy).toContain('tools/build-replay-nights.ts');
    expect(meta.builtOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('lists its assumptions, including that the building was untreated', () => {
    expect(meta.assumptions.length).toBeGreaterThan(3);
    expect(meta.assumptions.join(' ')).toMatch(/untreated/);
  });
});

describe('radar-nights.json nights', () => {
  it('has two to four events, quiet nights and busy few-bird nights in each season', () => {
    expect(nights.length).toBeGreaterThanOrEqual(12);
    for (const season of ['spring', 'fall']) {
      const inSeason = nights.filter((night) => night.season === season);
      expect(
        inSeason.filter((night) => night.kind === 'mortality-event').length,
      ).toBeGreaterThanOrEqual(2);
      expect(inSeason.filter((night) => night.kind === 'quiet').length).toBeGreaterThanOrEqual(1);
      expect(
        inSeason.filter((night) => night.kind === 'busy-few-birds').length,
      ).toBeGreaterThanOrEqual(1);
    }
  });

  it('labels every night as a replay with a source and a note (R6, R7, R26)', () => {
    for (const night of nights) {
      expect(night.source).toBe('replay');
      expect(night.migration.source).toBe('replay');
      expect(night.label).toBe('Replay night, radar-derived migration');
      expect(night.note.length).toBeGreaterThan(10);
      expect(night.id).toBe(`radar-${night.night}`);
    }
  });

  it('has unique dates in date order, each matched to the survey the next morning', () => {
    const dates = nights.map((night) => night.night);
    expect(dates).toEqual([...dates].sort());
    expect(new Set(dates).size).toBe(dates.length);
    for (const night of nights) {
      expect(night.night).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(nightOfSurvey(night.reference.surveyDate)).toBe(night.night);
    }
  });

  it('keeps migration levels between 0 and 1 and always has the middle part', () => {
    for (const night of nights) {
      expect(night.migration.middle).not.toBeNull();
      for (const part of PARTS) {
        const level = night.migration[part];
        expect(level === null || (level >= 0 && level <= 1)).toBe(true);
      }
    }
  });

  it('has finite weather numbers wherever a part has weather', () => {
    for (const night of nights) {
      for (const part of PARTS) {
        const weather = night.weather[part];
        if (weather !== null) {
          expect(Object.values(weather).every(Number.isFinite)).toBe(true);
        }
      }
    }
  });

  it('shows the pattern the research expects: events on heavy nights, quiet nights on light ones', () => {
    expect(median(middleLevels(byKind('mortality-event')))).toBeGreaterThanOrEqual(0.8);
    expect(Math.max(...middleLevels(byKind('quiet')))).toBeLessThanOrEqual(0.3);
    expect(Math.min(...middleLevels(byKind('busy-few-birds')))).toBeGreaterThanOrEqual(0.9);
  });

  it('keeps counts out of everything except the reference block', () => {
    for (const night of nights) {
      const { reference, ...rest } = night;
      expect(Object.keys(reference).sort()).toEqual(['birdsFound', 'litShare', 'surveyDate']);
      expect(JSON.stringify(rest)).not.toMatch(/birdsFound/);
    }
  });
});
