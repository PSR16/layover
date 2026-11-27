/**
 * Pure steps for building the radar replay-night table from the exported Chicago dataset
 * (Van Doren et al. 2021, CC BY 4.0, see docs/data-sources.md). No file or network access here,
 * so each step can be tested with a tiny fixture. The file reading lives in
 * tools/build-replay-nights.js.
 */
import { getNightTimes } from '../src/lib/night-times.js';
import { summarizeNight } from '../src/lib/night-parts.js';
import { percentileRanker } from '../src/lib/percentile.js';

const PARTS = ['early', 'middle', 'late'];
const MILLISECONDS_PER_DAY = 86_400_000;
const SPRING_BEFORE_DAY_OF_YEAR = 200; // the authors' rule: earlier is spring, later is fall
const LOW_CEILING_METERS = 1500; // ceiling below this counts as low cloud (assumption)
const ROUNDING = 1000;

/** Split simple CSV text (no quoted fields) into objects keyed by the header row. */
export function parseCsv(text) {
  const [header, ...lines] = text.trim().split(/\r?\n/);
  const names = header.split(',');
  return lines
    .filter((line) => line.length > 0)
    .map((line) => {
      const cells = line.split(',');
      return Object.fromEntries(names.map((name, index) => [name, cells[index] ?? '']));
    });
}

/** Number from a CSV cell; blank or bad cells give undefined. */
export function cellNumber(cell) {
  if (cell === undefined || cell === '') {
    return undefined;
  }
  const value = Number(cell);
  return Number.isFinite(value) ? value : undefined;
}

/** The dawn survey on date D looks at the night that started on D minus one day. */
export function nightOfSurvey(surveyDate) {
  const start = Date.parse(`${surveyDate}T00:00:00Z`);
  return new Date(start - MILLISECONDS_PER_DAY).toISOString().slice(0, 10);
}

/** Spring or fall by the dataset authors' day-of-year rule. */
export function datasetSeason(isoDate) {
  const date = new Date(`${isoDate}T00:00:00Z`);
  const yearStart = Date.UTC(date.getUTCFullYear(), 0, 1);
  const dayOfYear = Math.floor((date.getTime() - yearStart) / MILLISECONDS_PER_DAY) + 1;
  return dayOfYear < SPRING_BEFORE_DAY_OF_YEAR ? 'spring' : 'fall';
}

/** A ceiling under 1,500 m counts as full low cloud, otherwise none (assumption, E2, E11). */
export function ceilingToLowCloud(ceilingMeters) {
  if (!Number.isFinite(ceilingMeters)) {
    return undefined;
  }
  return ceilingMeters < LOW_CEILING_METERS ? 100 : 0;
}

/** Readings (sorted by time) that fall from `start` up to and including `end`. */
export function sliceByTime(sorted, start, end) {
  const from = start.getTime();
  const until = end.getTime();
  let low = 0;
  let high = sorted.length;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (sorted[middle].time.getTime() < from) {
      low = middle + 1;
    } else {
      high = middle;
    }
  }
  const result = [];
  for (
    let index = low;
    index < sorted.length && sorted[index].time.getTime() <= until;
    index += 1
  ) {
    result.push(sorted[index]);
  }
  return result;
}

function roundTo(value) {
  return Math.round(value * ROUNDING) / ROUNDING;
}

function roundFields(part) {
  if (!part) {
    return null;
  }
  return Object.fromEntries(Object.entries(part).map(([key, value]) => [key, roundTo(value)]));
}

/** Weather readings from an exported hourly row. */
export function weatherReading(row) {
  const reading = {
    time: new Date(row.time_utc),
    windFromDegrees: cellNumber(row.wind_from_degrees),
    windSpeedMps: cellNumber(row.wind_speed_mps),
    lowCloudPercent: ceilingToLowCloud(cellNumber(row.ceiling_m)),
    visibilityKm: cellNumber(row.visibility_km),
  };
  return Object.fromEntries(Object.entries(reading).filter(([, value]) => value !== undefined));
}

/** Radar readings from an exported scan row. */
export function radarReading(row) {
  return { time: new Date(row.time_utc), birdsPerCubicKilometer: cellNumber(row.birds_km3) };
}

/**
 * One candidate night from a survey day: raw radar means and weather per night part.
 * @param {{ surveyDate: string, birdsFound: number, litShare: number }} survey
 */
export function buildCandidate(survey, scans, weatherReadings, site) {
  const night = nightOfSurvey(survey.surveyDate);
  const { sunset, sunrise } = getNightTimes(night, site.latitude, site.longitude);
  const radar = summarizeNight(sliceByTime(scans, sunset, sunrise), sunset, sunrise);
  const weather = summarizeNight(sliceByTime(weatherReadings, sunset, sunrise), sunset, sunrise);
  return { night, season: datasetSeason(night), ...survey, radar, weather };
}

function partValues(candidates, part) {
  return candidates.map((candidate) => candidate.radar[part]?.birdsPerCubicKilometer);
}

/**
 * Add a 0 to 1 migration level per night part: the percentile of that part's radar density among
 * all nights of the same season (R26). A part with no radar scans gets null.
 */
export function addMigrationLevels(candidates) {
  const rankers = {};
  for (const season of ['spring', 'fall']) {
    const inSeason = candidates.filter((candidate) => candidate.season === season);
    rankers[season] = Object.fromEntries(
      PARTS.map((part) => [part, percentileRanker(partValues(inSeason, part))]),
    );
  }
  return candidates.map((candidate) => ({
    ...candidate,
    migration: Object.fromEntries(
      PARTS.map((part) => {
        const raw = candidate.radar[part]?.birdsPerCubicKilometer;
        const level = rankers[candidate.season][part](raw);
        return [part, level === undefined ? null : roundTo(level)];
      }),
    ),
  }));
}

function middleLevel(candidate) {
  return candidate.migration.middle ?? -1;
}

function bySeason(candidates, season) {
  return candidates.filter(
    (candidate) => candidate.season === season && candidate.migration.middle !== null,
  );
}

function topBy(list, count, compare) {
  return [...list].sort(compare).slice(0, count);
}

const byBirdsThenDate = (first, second) =>
  second.birdsFound - first.birdsFound || first.night.localeCompare(second.night);
const byQuietThenDate = (first, second) =>
  middleLevel(first) - middleLevel(second) || first.night.localeCompare(second.night);
const byBusyThenDate = (first, second) =>
  middleLevel(second) - middleLevel(first) || first.night.localeCompare(second.night);

/**
 * Pick the nights to keep, per season: the biggest mortality events, quiet nights with the lights
 * on (low migration, nothing found), and busy migration nights with almost nothing found.
 * The same input always gives the same nights (ties break on date).
 */
export function chooseNights(candidates, counts = { events: 4, quiet: 2, busy: 2 }) {
  const chosen = [];
  for (const season of ['spring', 'fall']) {
    const pool = bySeason(candidates, season);
    const events = topBy(pool, counts.events, byBirdsThenDate);
    const quiet = topBy(
      pool.filter((entry) => entry.birdsFound === 0 && entry.litShare >= 0.8),
      counts.quiet,
      byQuietThenDate,
    );
    const busy = topBy(
      pool.filter((entry) => entry.birdsFound <= 1),
      counts.busy,
      byBusyThenDate,
    );
    chosen.push(
      ...events.map((entry) => ({ ...entry, kind: 'mortality-event' })),
      ...quiet.map((entry) => ({ ...entry, kind: 'quiet' })),
      ...busy.map((entry) => ({ ...entry, kind: 'busy-few-birds' })),
    );
  }
  return [...new Map(chosen.map((entry) => [entry.night, entry])).values()].sort((first, second) =>
    first.night.localeCompare(second.night),
  );
}

const KIND_NOTES = {
  'mortality-event':
    'One of the largest dawn finds of its season at the survey building (before treatment).',
  quiet: 'Low migration, lights mostly on, nothing found at dawn.',
  'busy-few-birds': 'Heavy migration but almost nothing found at dawn.',
};

/** The committed record for one chosen night. Counts are for checking only, never shown. */
export function toReplayNight(candidate) {
  const weather = Object.fromEntries(
    PARTS.map((part) => [part, roundFields(candidate.weather[part])]),
  );
  return {
    id: `radar-${candidate.night}`,
    night: candidate.night,
    season: candidate.season,
    kind: candidate.kind,
    source: 'replay',
    label: 'Replay night, radar-derived migration',
    migration: { ...candidate.migration, source: 'replay' },
    weather,
    note: KIND_NOTES[candidate.kind],
    reference: {
      surveyDate: candidate.surveyDate,
      birdsFound: candidate.birdsFound,
      litShare: roundTo(candidate.litShare),
    },
  };
}
