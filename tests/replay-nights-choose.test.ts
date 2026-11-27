import { describe, it, expect } from 'vitest';
import { addMigrationLevels, chooseNights, toReplayNight } from '../tools/replay-nights-core.ts';

function candidateWith(night, season, middle, extra = {}) {
  const part = (value) => (value === null ? null : { birdsPerCubicKilometer: value });
  return {
    night,
    season,
    surveyDate: night,
    birdsFound: 0,
    litShare: 1,
    radar: { early: part(middle), middle: part(middle), late: part(middle) },
    weather: { early: null, middle: null, late: null },
    ...extra,
  };
}

describe('addMigrationLevels (R26)', () => {
  const pool = [
    candidateWith('2018-05-01', 'spring', 10),
    candidateWith('2018-05-02', 'spring', 20),
    candidateWith('2018-05-03', 'spring', 30),
    candidateWith('2018-10-01', 'fall', 1000),
    candidateWith('2018-10-02', 'fall', null),
  ];
  const levels = addMigrationLevels(pool);

  it('ranks each night against other nights of the same season, lowest to highest', () => {
    const spring = levels
      .filter((entry) => entry.season === 'spring')
      .map((entry) => entry.migration.middle);
    expect(spring[0]).toBeLessThan(spring[1]);
    expect(spring[1]).toBeLessThan(spring[2]);
    expect(spring.every((level) => level > 0 && level < 1)).toBe(true);
  });

  it('does not let the other season change the ranks', () => {
    const fallOnly = addMigrationLevels(pool.filter((entry) => entry.season === 'spring'));
    expect(fallOnly.map((entry) => entry.migration.middle)).toEqual(
      levels.filter((entry) => entry.season === 'spring').map((entry) => entry.migration.middle),
    );
  });

  it('gives null for a night with no radar scans', () => {
    expect(levels.at(-1).migration).toEqual({ early: null, middle: null, late: null });
  });
});

describe('chooseNights', () => {
  const birdsOnDay = (day) => {
    if (day === 5) {
      return 90;
    }
    if (day === 9) {
      return 70;
    }
    return day <= 3 ? 0 : 2;
  };
  const nights = [];
  for (let day = 1; day <= 20; day += 1) {
    const night = `2018-05-${String(day).padStart(2, '0')}`;
    nights.push(
      candidateWith(night, 'spring', day, {
        birdsFound: birdsOnDay(day),
      }),
    );
  }
  const ranked = addMigrationLevels(nights);

  it('keeps the biggest events, the quietest unlit-free nights and the busiest few-bird nights', () => {
    const chosen = chooseNights(ranked, { events: 2, quiet: 2, busy: 1 });
    const kinds = Object.fromEntries(chosen.map((entry) => [entry.night, entry.kind]));
    expect(kinds['2018-05-05']).toBe('mortality-event');
    expect(kinds['2018-05-09']).toBe('mortality-event');
    expect(kinds['2018-05-01']).toBe('quiet');
    expect(kinds['2018-05-02']).toBe('quiet');
  });

  it('returns nights sorted by date, once each', () => {
    const chosen = chooseNights(ranked, { events: 2, quiet: 2, busy: 1 });
    const dates = chosen.map((entry) => entry.night);
    expect(dates).toEqual([...dates].sort());
    expect(new Set(dates).size).toBe(dates.length);
  });

  it('skips quiet nights whose lights were mostly off', () => {
    const dark = ranked.map((entry) => ({
      ...entry,
      litShare: entry.night <= '2018-05-02' ? 0.5 : 1,
    }));
    const chosen = chooseNights(dark, { events: 0, quiet: 2, busy: 0 });
    expect(chosen.map((entry) => entry.night)).toEqual(['2018-05-03']);
  });

  it('gives the same nights whatever order the input arrives in', () => {
    const counts = { events: 2, quiet: 2, busy: 2 };
    const forward = chooseNights(ranked, counts).map((entry) => entry.night);
    const reversed = chooseNights([...ranked].reverse(), counts).map((entry) => entry.night);
    expect(reversed).toEqual(forward);
  });
});

describe('toReplayNight', () => {
  const [candidate] = addMigrationLevels([
    candidateWith('2018-05-01', 'spring', 10, { birdsFound: 3, litShare: 0.923_456 }),
  ]);
  const record = toReplayNight({ ...candidate, kind: 'quiet', surveyDate: '2018-05-02' });

  it('labels the record as a radar replay night with source replay (R6, R7)', () => {
    expect(record).toMatchObject({
      id: 'radar-2018-05-01',
      night: '2018-05-01',
      source: 'replay',
      label: 'Replay night, radar-derived migration',
    });
    expect(record.migration.source).toBe('replay');
  });

  it('rounds numbers and keeps missing weather parts as null', () => {
    expect(record.reference).toEqual({ surveyDate: '2018-05-02', birdsFound: 3, litShare: 0.923 });
    expect(record.weather).toEqual({ early: null, middle: null, late: null });
  });
});
