import { describe, it, expect } from 'vitest';
import { REPLAY_NIGHTS } from '../src/data/replay-nights.ts';
import { CHICAGO_RISK_OVERRIDES } from '../src/config/chicago-risk.ts';
import { conditionsFromReplay } from '../src/lib/replay-conditions.ts';
import { levelRank } from '../src/lib/risk-combine.ts';
import { assessNight, assessPlace } from '../src/lib/risk.ts';

/*
 * Pinned results for the 18 replay nights under the Chicago lakefront overlay (Task 11).
 * Each entry is [night-level, building-level]. These are regression pins, not claims of truth:
 * if the config changes, re-read docs/calibration-report.md and update them on purpose.
 * The building is the survey building with that day's real lit share (0.9 for the news nights).
 */
const PINS = {
  'radar-2000-10-14': ['high', 'high'],
  'radar-2001-10-12': ['elevated', 'high'],
  'radar-2002-05-05': ['high', 'high'],
  'radar-2004-03-20': ['low', 'low'], // 80 birds on a night with modest migration: a known miss
  'radar-2007-09-07': ['high', 'high'], // busy night, 1 bird found: a known false alarm
  'radar-2007-10-08': ['high', 'high'],
  'radar-2008-05-06': ['high', 'high'],
  'radar-2008-10-30': ['low', 'low'],
  'radar-2011-03-15': ['low', 'low'],
  'radar-2013-10-07': ['high', 'elevated'],
  'radar-2016-03-04': ['low', 'low'],
  'radar-2016-05-10': ['high', 'high'], // fog night, 0 birds, 56% lit: a known false alarm
  'radar-2016-10-16': ['low', 'low'],
  'radar-2018-05-01': ['high', 'high'],
  'radar-2018-05-21': ['high', 'high'], // low visibility, 1 bird found: a known false alarm
  'radar-2020-09-13': ['high', 'elevated'], // dark building (52% lit) lowers the building level
  'news-2023-10-04': ['high', 'high'],
  'news-2026-10-16': ['high', 'high'],
};

function building(record) {
  return {
    id: 'survey-building',
    kind: 'building',
    lit: true,
    litGlassArea: record.reference?.litShare ?? 0.9,
    treeNear: true,
    heightMeters: 30,
    lakeDistanceMeters: 300,
    birdSafeTreatment: 'none',
  };
}

function assessBoth(record) {
  const conditions = conditionsFromReplay(record);
  return {
    night: assessNight(conditions, CHICAGO_RISK_OVERRIDES),
    place: assessPlace(building(record), conditions, CHICAGO_RISK_OVERRIDES),
  };
}

const results = Object.fromEntries(REPLAY_NIGHTS.map((record) => [record.id, assessBoth(record)]));
const ofKind = (kind) => REPLAY_NIGHTS.filter((record) => record.kind === kind);
const levels = (records, which) => records.map((record) => results[record.id][which].level);

describe('replay night pins (Task 11)', () => {
  it('covers every replay night exactly once', () => {
    expect(Object.keys(PINS).sort()).toEqual(REPLAY_NIGHTS.map((record) => record.id).sort());
  });

  it.each(Object.entries(PINS))('%s is rated as pinned', (id, [nightLevel, placeLevel]) => {
    expect(results[id].night.level).toBe(nightLevel);
    expect(results[id].place.level).toBe(placeLevel);
  });

  it('uses the Chicago overlay version', () => {
    expect(results['radar-2018-05-01'].night.configVersion).toBe('0.2.0-chicago-lakefront');
  });
});

describe('replay night patterns the research expects', () => {
  it('rates every quiet night low at both levels', () => {
    expect(levels(ofKind('quiet'), 'night')).toEqual(['low', 'low', 'low', 'low']);
    expect(levels(ofKind('quiet'), 'place')).toEqual(['low', 'low', 'low', 'low']);
  });

  it('rates most event nights high at building level and none below elevated except the known miss', () => {
    const events = ofKind('mortality-event');
    const high = levels(events, 'place').filter((level) => level === 'high').length;
    expect(high).toBeGreaterThanOrEqual(6);
    const lower = events.filter((record) => results[record.id].place.level === 'low');
    expect(lower.map((record) => record.id)).toEqual(['radar-2004-03-20']);
  });

  it('scores every event night above every quiet night in the same season', () => {
    for (const season of ['spring', 'fall']) {
      const quiet = ofKind('quiet').filter((record) => record.season === season);
      const events = ofKind('mortality-event').filter((record) => record.season === season);
      const lowestEvent = Math.min(
        ...events.map((record) => results[record.id].place.internal.totalPoints),
      );
      const highestQuiet = Math.max(
        ...quiet.map((record) => results[record.id].place.internal.totalPoints),
      );
      if (season === 'fall') {
        expect(lowestEvent).toBeGreaterThan(highestQuiet);
      } else {
        // the spring miss (2004-03-20) sits below some quiet nights, so compare the rest
        const others = events.filter((record) => record.id !== 'radar-2004-03-20');
        const lowestOther = Math.min(
          ...others.map((record) => results[record.id].place.internal.totalPoints),
        );
        expect(lowestOther).toBeGreaterThan(highestQuiet);
      }
    }
  });

  it('rates the darkest busy night lower at building level than at night level (E1, E8)', () => {
    const dark = results['radar-2020-09-13'];
    expect(levelRank(dark.place.level)).toBeLessThan(levelRank(dark.night.level));
  });

  it('puts the unfavorable-wind 2023 news night above the favorable-wind 2026 night', () => {
    const points = (id) => results[id].night.internal.totalPoints;
    expect(points('news-2023-10-04')).toBeGreaterThan(points('news-2026-10-16'));
  });
});
