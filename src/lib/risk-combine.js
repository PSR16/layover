/**
 * Combine factor results into one risk result. This is the only place that knows the maths:
 * thresholds, the light and treatment multipliers, the weather-only cap and floor, and the
 * missing-migration cap. Factors, weights and wording all come from the config (R30, R31).
 *
 * Points are internal. The result exposes only level, reasons, missingInputs, configVersion,
 * a trace for tests and an `internal` block that the UI must never render (R9, R34).
 */
import { migrationLevel, seasonOf, summarizeWeather, weatherScale } from './risk-inputs.js';

const LEVEL_ORDER = ['low', 'elevated', 'high'];
const TREATMENT_STATUSES = ['none', 'partial', 'full'];

/** Reason keys that only the combine step can produce (validator rule 5). */
export const COMBINE_REASON_KEYS = [
  'missingMigration',
  'weatherOnlyElevated',
  'quiet',
  'birdSafeGlass',
];

export function levelRank(level) {
  return LEVEL_ORDER.indexOf(level);
}

export function levelFromPoints(points, thresholds) {
  if (points >= thresholds.high) {
    return 'high';
  }
  return points >= thresholds.elevated ? 'elevated' : 'low';
}

function capLevelAt(level, cap) {
  return levelRank(level) > levelRank(cap) ? cap : level;
}

function raiseLevelTo(level, floor) {
  return levelRank(level) < levelRank(floor) ? floor : level;
}

/**
 * Apply the missing-migration cap (R22), the light-migration cap and the unfavorable-weather
 * floor (R15). Returns the adjusted level and the reason keys that explain the change.
 */
export function adjustLevel(level, context, config) {
  const notes = [];
  let adjusted = level;
  if (context.migration === undefined) {
    adjusted = capLevelAt(adjusted, config.missingMigrationCap);
    notes.push('missingMigration');
  } else if (context.migration < config.migrationBands.moderate) {
    adjusted = capLevelAt(adjusted, config.weatherOnly.capLevel);
  }
  if (context.weatherPoints >= config.weatherOnly.floorMinPoints) {
    const raised = raiseLevelTo(adjusted, config.weatherOnly.floorLevel);
    if (raised !== adjusted) {
      notes.push('weatherOnlyElevated');
    }
    adjusted = raised;
  }
  return { level: adjusted, notes };
}

/** Low cloud and low visibility make lit places more attractive, most on heavy nights (R14). */
export function lightMultiplier(conditions, config) {
  const season = seasonOf(conditions.night, config);
  const weather = summarizeWeather(conditions.weather, season, config);
  const scale = weatherScale(migrationLevel(conditions.migration, config), config);
  const { cloudFactor, visibilityFactor } = config.lightMultiplier;
  const cloudShare = weather.lowCloud ?? 0;
  const visibilityShare = weather.lowVisibility ?? 0;
  const value =
    (1 + (cloudFactor - 1) * cloudShare * scale) *
    (1 + (visibilityFactor - 1) * visibilityShare * scale);
  return { value, cloudActive: cloudShare > 0 };
}

/** Bird-safe treatment removes part of the light group's contribution (R40, E22). */
export function treatmentMultiplier(place, config) {
  const requested = place?.birdSafeTreatment;
  const status = TREATMENT_STATUSES.includes(requested) ? requested : 'none';
  return { value: 1 - config.treatmentDiscount[status], status };
}

function sumPoints(entries, group) {
  return entries
    .filter((entry) => entry.output.group === group)
    .reduce((total, entry) => total + entry.output.points, 0);
}

/** One trace line per factor, with its final contribution after the multipliers. */
function traceFor(entries, lightFactor) {
  return entries.map(({ factor, output }) => ({
    factorId: output.id,
    group: output.group,
    contribution: output.group === 'light' ? output.points * lightFactor : output.points,
    evidence: factor.evidence,
  }));
}

function reasonKeysFor(entries, contributionById, extraKeys) {
  const active = entries
    .filter(({ output }) => output.reasonKey && contributionById.get(output.id) > 0)
    .sort((first, second) => {
      return contributionById.get(second.output.id) - contributionById.get(first.output.id);
    })
    .map(({ output }) => output.reasonKey);
  return [...new Set([...active, ...extraKeys])];
}

function reasonTexts(keys, config) {
  const texts = keys.map((key) => config.reasons[key]);
  return texts.length > 0 ? texts : [config.reasons.quiet];
}

/**
 * Combine the evaluated factors for one night (and one place, if given).
 * @param {{ factor: object, output: object }[]} entries every factor with its output
 */
export function combine({ entries, conditions, place, config }) {
  const light = place ? lightMultiplier(conditions, config) : { value: 1, cloudActive: false };
  const treatment = place ? treatmentMultiplier(place, config) : { value: 1, status: 'none' };
  const lightFactor = light.value * treatment.value;
  const trace = traceFor(entries, lightFactor);
  const totalPoints = trace.reduce((total, line) => total + line.contribution, 0);
  const level = migrationLevel(conditions.migration, config);
  const thresholds = place ? config.placeThresholds : config.thresholds;
  const adjusted = adjustLevel(
    levelFromPoints(totalPoints, thresholds),
    { migration: level, weatherPoints: sumPoints(entries, 'weather') },
    config,
  );
  const contributionById = new Map(trace.map((line) => [line.factorId, line.contribution]));
  const lightPoints = sumPoints(entries, 'light');
  const extraKeys = [
    ...(light.cloudActive && lightPoints > 0 ? ['lowCloud'] : []),
    ...(treatment.status !== 'none' && lightPoints > 0 ? ['birdSafeGlass'] : []),
    ...adjusted.notes,
  ];
  const keys = reasonKeysFor(entries, contributionById, extraKeys);
  return {
    level: adjusted.level,
    reasons: reasonTexts(keys, config),
    missingInputs: [...new Set(entries.flatMap(({ output }) => output.missing))].sort(),
    configVersion: config.version,
    trace,
    internal: {
      totalPoints,
      lightMultiplier: light.value,
      treatmentMultiplier: treatment.value,
      levelBeforeAdjustments: levelFromPoints(totalPoints, thresholds),
    },
  };
}
