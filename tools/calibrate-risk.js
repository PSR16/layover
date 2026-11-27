#!/usr/bin/env node
/**
 * Check the risk engine against every survey night in the Chicago dataset (3,462 nights), with
 * years kept back for testing. Prints tables only; it changes nothing.
 *
 *   npx vite-node tools/calibrate-risk.js --data ~/Documents/Development/layover-data/derived
 *
 * Each night is scored as the survey building (McCormick Place, untreated) with that day's real
 * lit share, radar migration percentile and Midway weather. "Birds found" is used only here, to
 * judge the engine. The interface never shows it (product rule).
 */
import { parseArgs } from 'node:util';
import { DEFAULT_CONFIG } from '../src/lib/risk-config.js';
import { adjustLevel, levelFromPoints } from '../src/lib/risk-combine.js';
import { migrationLevel } from '../src/lib/risk-inputs.js';
import { createRiskEngine } from '../src/lib/risk.js';
import { isInSector } from '../src/lib/wind.js';
import { NIGHT_FACTORS } from '../src/lib/risk-night-factors.js';
import { PLACE_FACTORS } from '../src/lib/risk-place-factors.js';
import { auc, levelBreakdown, spearman, topShare } from './calibration-metrics.js';
import { DEFAULT_DATA_DIRECTORY, loadCandidates } from './chicago-data.js';

const EVENT_BIRDS = 10; // a night counts as an event at this many birds or more
const TOP_FRACTION = 0.15; // research E5: about 15 percent of days cause most deaths

function venue(litShare) {
  return {
    id: 'survey-building',
    kind: 'building',
    lit: true,
    litGlassArea: litShare,
    treeNear: true,
    heightMeters: 30,
    lakeDistanceMeters: 300,
    birdSafeTreatment: 'none',
  };
}

function conditionsOf(candidate) {
  return { night: candidate.night, migration: candidate.migration, weather: candidate.weather };
}

/** Light-group factors scaled by migration, so lit glass matters when birds are overhead (E1, E8). */
function scaledByMigration(factors, minimum) {
  return factors.map((factor) => {
    if (factor.group !== 'light') {
      return factor;
    }
    return {
      ...factor,
      evaluate(place, conditions, config) {
        const output = factor.evaluate(place, conditions, config);
        const level = migrationLevel(conditions.migration, config);
        const scale =
          level === undefined ? 1 : minimum + (1 - minimum) * Math.min(Math.max(level, 0), 1);
        return { ...output, points: output.points * scale };
      },
    };
  });
}

function engineWith(placeFactors) {
  return createRiskEngine({ nightFactors: NIGHT_FACTORS, placeFactors });
}

function quantile(values, fraction) {
  const sorted = [...values].sort((first, second) => first - second);
  return sorted[Math.min(sorted.length - 1, Math.floor(fraction * sorted.length))];
}

function weatherPoints(result) {
  return result.trace
    .filter((line) => line.group === 'weather')
    .reduce((sum, line) => sum + line.contribution, 0);
}

function levelFor(result, candidate, thresholds) {
  const migration = migrationLevel(candidate.migration, DEFAULT_CONFIG);
  const base = levelFromPoints(result.internal.totalPoints, thresholds);
  return adjustLevel(base, { migration, weatherPoints: weatherPoints(result) }, DEFAULT_CONFIG)
    .level;
}

const percent = (value) =>
  value === undefined ? '  n/a' : `${(value * 100).toFixed(0).padStart(4)}%`;
const decimal = (value) => (value === undefined ? ' n/a ' : value.toFixed(3));

function describeSplit(name, rows) {
  const birds = rows.map((row) => row.birds);
  const points = rows.map((row) => row.points);
  const levels = levelBreakdown(
    rows.map((row) => row.level),
    birds,
  );
  const events = birds.map((count) => count >= EVENT_BIRDS);
  const cell = (level) =>
    `${percent(levels[level].nights)} nights ${percent(levels[level].birds)} birds ${levels[level].meanBirds.toFixed(1).padStart(5)}/night`;
  console.log(
    `  ${name.padEnd(6)} AUC ${decimal(auc(points, events))}  rho ${decimal(spearman(points, birds))}  ` +
      `top${TOP_FRACTION * 100}% ${percent(topShare(points, birds, TOP_FRACTION))}  | ` +
      `high ${cell('high')} | elevated ${cell('elevated')} | low ${cell('low')}`,
  );
}

const yearOf = (row) => Number(row.candidate.night.slice(0, 4));

function evaluate({ label, candidates, assess, thresholdsFor, splitYear }) {
  const rows = candidates.map((candidate) => {
    const result = assess(candidate);
    return { candidate, result, birds: candidate.birdsFound, points: result.internal.totalPoints };
  });
  const train = rows.filter((row) => yearOf(row) <= splitYear);
  const thresholds = thresholdsFor(train.map((row) => row.points));
  for (const row of rows) {
    row.level = levelFor(row.result, row.candidate, thresholds);
  }
  console.log(
    `\n${label}  [elevated ${thresholds.elevated.toFixed(2)}, high ${thresholds.high.toFixed(2)}]`,
  );
  describeSplit('train', train);
  describeSplit(
    'test',
    rows.filter((row) => yearOf(row) > splitYear),
  );
  return rows;
}

const asConfigured = () => DEFAULT_CONFIG.thresholds;
const fromQuantiles = (points) => ({
  elevated: quantile(points, 1 - TOP_FRACTION - 0.2),
  high: quantile(points, 1 - TOP_FRACTION),
});

const SIGNALS = {
  'migration (middle part)': (candidate) => candidate.migration.middle,
  'lit share alone': (candidate) => candidate.litShare,
  'migration x lit share': (candidate) => candidate.migration.middle * candidate.litShare,
  'migration x lit share squared': (candidate) =>
    candidate.migration.middle * candidate.litShare ** 2,
  'migration squared x lit share': (candidate) =>
    candidate.migration.middle ** 2 * candidate.litShare,
};

function describeSignals(candidates, splitYear) {
  console.log(
    '\nSingle signals, for comparison (AUC for event nights, Spearman with birds found):',
  );
  for (const [name, score] of Object.entries(SIGNALS)) {
    const cells = [
      ['train', (candidate) => Number(candidate.night.slice(0, 4)) <= splitYear],
      ['test', (candidate) => Number(candidate.night.slice(0, 4)) > splitYear],
    ].map(([part, inPart]) => {
      const rows = candidates.filter(inPart);
      const birds = rows.map((candidate) => candidate.birdsFound);
      const scores = rows.map(score);
      return `${part} AUC ${decimal(
        auc(
          scores,
          birds.map((count) => count >= EVENT_BIRDS),
        ),
      )} rho ${decimal(spearman(scores, birds))}`;
    });
    console.log(`  ${name.padEnd(32)} ${cells.join('  |  ')}`);
  }
}

const COMPASS_SECTORS = { south: [135, 225], west: [225, 315], north: [315, 45], east: [45, 135] };
const HEAVY_MIGRATION = 0.7;

function eventRate(list) {
  if (list.length === 0) {
    return '   n/a';
  }
  const events = list.filter((candidate) => candidate.birdsFound >= EVENT_BIRDS).length;
  return `${((events / list.length) * 100).toFixed(0).padStart(3)}% of ${String(list.length).padStart(3)}`;
}

/** Event rate on heavy-migration nights by wind direction, per season, for train and test years. */
function describeWind(candidates, splitYear) {
  console.log(
    `\nEvent rate on heavy-migration nights (middle part at or above ${HEAVY_MIGRATION}), by wind direction:`,
  );
  const heavy = candidates.filter(
    (candidate) =>
      candidate.migration.middle >= HEAVY_MIGRATION &&
      candidate.weather.middle?.windFromDegrees !== undefined,
  );
  for (const season of ['spring', 'fall']) {
    for (const [name, sector] of Object.entries(COMPASS_SECTORS)) {
      const cells = ['train', 'test'].map((part) => {
        const set = heavy.filter(
          (candidate) =>
            candidate.season === season &&
            Number(candidate.night.slice(0, 4)) <= splitYear === (part === 'train'),
        );
        const inside = set.filter((candidate) =>
          isInSector(candidate.weather.middle.windFromDegrees, sector),
        );
        const outside = set.filter(
          (candidate) => !isInSector(candidate.weather.middle.windFromDegrees, sector),
        );
        return `${part}: wind from ${name} ${eventRate(inside)}, other ${eventRate(outside)}`;
      });
      console.log(`  ${season.padEnd(6)} ${cells.join('  |  ')}`);
    }
  }
}

/** Chicago lakefront wind: in this data, spring south wind and fall west wind go with collision nights. */
const LOCAL_WIND = {
  wind: { spring: { unfavorableFrom: [[135, 225]] }, fall: { unfavorableFrom: [[225, 315]] } },
};

function experiments(baseline) {
  const placeAssess = (engine, overrides) => (candidate) =>
    engine.assessPlace(venue(candidate.litShare), conditionsOf(candidate), overrides);
  const nightAssess = (overrides) => (candidate) =>
    baseline.assessNight(conditionsOf(candidate), overrides);
  const list = [
    ['A. building, engine as built', placeAssess(baseline), asConfigured],
    [
      'B. building, thresholds from the top 15% of train nights',
      placeAssess(baseline),
      fromQuantiles,
    ],
    [
      'D. building, Chicago wind sectors, quantile thresholds',
      placeAssess(baseline, LOCAL_WIND),
      fromQuantiles,
    ],
    ['N0. night only, default wind sectors, quantile thresholds', nightAssess(), fromQuantiles],
    ['N1. night only, engine as built', nightAssess(), asConfigured],
    [
      'N2. night only, Chicago wind sectors, quantile thresholds',
      nightAssess(LOCAL_WIND),
      fromQuantiles,
    ],
  ];
  for (const minimum of [0.4, 0.1]) {
    const scaled = engineWith(scaledByMigration(PLACE_FACTORS, minimum));
    const label = `C. building, lit factors scaled by migration (minimum ${minimum}), quantile thresholds`;
    list.push([label, placeAssess(scaled), fromQuantiles]);
  }
  return list;
}

function main() {
  const { values } = parseArgs({
    options: {
      data: { type: 'string', default: DEFAULT_DATA_DIRECTORY },
      'split-year': { type: 'string', default: '2012' },
    },
  });
  const splitYear = Number(values['split-year']);
  const candidates = loadCandidates(values.data).filter(
    (candidate) => candidate.migration.middle !== null,
  );
  const eventCount = candidates.filter((candidate) => candidate.birdsFound >= EVENT_BIRDS).length;
  console.log(
    `${candidates.length} nights with radar, ${eventCount} event nights (${EVENT_BIRDS}+ birds). Train: up to ${splitYear}. Test: after.`,
  );
  describeSignals(candidates, splitYear);
  describeWind(candidates, splitYear);
  for (const [label, assess, thresholdsFor] of experiments(engineWith(PLACE_FACTORS))) {
    evaluate({ label, candidates, assess, thresholdsFor, splitYear });
  }
}

main();
