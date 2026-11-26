/**
 * Rules that check a risk config against the research rules (R32).
 * Every check returns a list of plain-text problems, so a bad edit says exactly what to fix.
 */

const EVIDENCE_ENTRY = /^(E\d+|assumption)$/;
const LEVELS = ['low', 'elevated', 'high'];
const FULL_CIRCLE = 360;
const SEASON_NAMES = ['spring', 'fall'];
const EVIDENCE_GROUPS = ['nightParts', 'lightMultiplier', 'weatherOnly', 'weatherScaling', 'wind'];
const SUM_TOLERANCE = 1e-6;

export function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isValidEvidence(evidence) {
  return (
    Array.isArray(evidence) &&
    evidence.length > 0 &&
    evidence.every((entry) => EVIDENCE_ENTRY.test(entry))
  );
}

function weightOf(config, name) {
  const value = config.weights?.[name]?.weight;
  return Number.isFinite(value) ? value : undefined;
}

/** Rule 1: every weight and group needs evidence IDs or the word "assumption". */
function checkEvidence(config) {
  const problems = [];
  const entries = Object.entries(config.weights ?? {}).map(([name, entry]) => [
    `weights.${name}`,
    entry,
  ]);
  for (const group of EVIDENCE_GROUPS) {
    entries.push([group, config[group]]);
  }
  for (const [path, entry] of entries) {
    if (!isValidEvidence(entry?.evidence)) {
      problems.push(`${path}.evidence must list evidence IDs like "E1" or "assumption"`);
    }
  }
  return problems;
}

/** Weights must be numbers from 0 to 1. */
function checkWeightValues(config) {
  if (!isPlainObject(config.weights)) {
    return ['weights is missing'];
  }
  return Object.keys(config.weights)
    .filter((name) => {
      const value = weightOf(config, name);
      return value === undefined || value < 0 || value > 1;
    })
    .map((name) => `weights.${name}.weight must be a number from 0 to 1`);
}

function mustBeBelow(config, smaller, larger) {
  const small = weightOf(config, smaller);
  const large = weightOf(config, larger);
  if (small === undefined || large === undefined || small < large) {
    return [];
  }
  return [`weights.${smaller}.weight must be below weights.${larger}.weight`];
}

/** Rule 2: migration is the largest weight (R10). */
function checkMigrationLargest(config) {
  if (weightOf(config, 'migration') === undefined) {
    return ['weights.migration.weight is missing'];
  }
  return Object.keys(config.weights)
    .filter((name) => name !== 'migration')
    .flatMap((name) => mustBeBelow(config, name, 'migration'));
}

/** Rule 3: height is weaker than lit glass, stadium and trees (R13). */
function checkHeightWeak(config) {
  return ['litGlass', 'stadium', 'tree'].flatMap((larger) => mustBeBelow(config, 'height', larger));
}

/** The lakeshore factor never outweighs lit glass (R38, assumption). */
function checkLakeshoreWeak(config) {
  const lakeshore = weightOf(config, 'lakeshore');
  const litGlass = weightOf(config, 'litGlass');
  if (lakeshore !== undefined && litGlass !== undefined && lakeshore > litGlass) {
    return ['weights.lakeshore.weight must not be above weights.litGlass.weight'];
  }
  return [];
}

function checkWeightOrder(config) {
  if (!isPlainObject(config.weights)) {
    return [];
  }
  return [
    ...checkMigrationLargest(config),
    ...checkHeightWeak(config),
    ...checkLakeshoreWeak(config),
  ];
}

/** Rule 4: level thresholds in order and inside 0 to 1. */
function checkThresholds(config) {
  const { elevated, high } = config.thresholds ?? {};
  const valid = Number.isFinite(elevated) && Number.isFinite(high);
  if (!valid || elevated <= 0 || high <= elevated || high > 1) {
    return ['thresholds must satisfy 0 < elevated < high <= 1'];
  }
  return [];
}

/** Night part weights add up to 1, with the middle part highest (R37). */
function checkNightParts(config) {
  const { early, middle, late } = config.nightParts ?? {};
  const parts = [early, middle, late];
  if (!parts.every((part) => Number.isFinite(part) && part >= 0)) {
    return ['nightParts early, middle and late must be numbers of 0 or more'];
  }
  const problems = [];
  if (Math.abs(early + middle + late - 1) > SUM_TOLERANCE) {
    problems.push('nightParts early, middle and late must add up to 1');
  }
  if (middle <= early || middle <= late) {
    problems.push('nightParts.middle must be the largest part');
  }
  return problems;
}

function isValidSector(sector) {
  return (
    Array.isArray(sector) &&
    sector.length === 2 &&
    sector.every((degrees) => Number.isFinite(degrees) && degrees >= 0 && degrees <= FULL_CIRCLE)
  );
}

function checkWindSectors(config, season) {
  const sectors = config.wind?.[season]?.unfavorableFrom;
  const valid = Array.isArray(sectors) && sectors.length > 0 && sectors.every(isValidSector);
  return valid ? [] : [`wind.${season}.unfavorableFrom needs sectors like [135, 315]`];
}

function checkSeasonWindow(config, season) {
  const window = config.seasons?.[season];
  const valid = Array.isArray(window) && window.length === 2 && window[0] < window[1];
  return valid ? [] : [`seasons.${season} needs a start and end like ["03-15", "06-05"]`];
}

/** Rule 6: both seasons need wind sectors and date windows. */
function checkSeasonsAndWind(config) {
  return SEASON_NAMES.flatMap((season) => [
    ...checkWindSectors(config, season),
    ...checkSeasonWindow(config, season),
  ]);
}

function isShare(value) {
  return Number.isFinite(value) && value >= 0 && value <= 1;
}

/** Weather scaling and light-wind share are shares from 0 to 1. */
function checkShares(config) {
  const problems = [];
  if (!isShare(config.weatherScaling?.minimum)) {
    problems.push('weatherScaling.minimum must be a number from 0 to 1');
  }
  if (!isShare(config.wind?.lightWindFactor)) {
    problems.push('wind.lightWindFactor must be a number from 0 to 1');
  }
  return problems;
}

function checkVenueKinds(config) {
  const kinds = config.weights?.stadium?.kinds;
  const valid =
    Array.isArray(kinds) && kinds.length > 0 && kinds.every((kind) => typeof kind === 'string');
  return valid ? [] : ['weights.stadium.kinds must list venue kinds like "stadium"'];
}

function checkPositiveSettings(config) {
  const weights = config.weights ?? {};
  return [
    ['weights.height.fullAtMeters', weights.height?.fullAtMeters],
    ['weights.lakeshore.maxDistanceMeters', weights.lakeshore?.maxDistanceMeters],
  ]
    .filter(([, value]) => !Number.isFinite(value) || value <= 0)
    .map(([path]) => `${path} must be a number above 0`);
}

/** Place settings used by the place factors. */
function checkPlaceSettings(config) {
  const problems = [...checkVenueKinds(config), ...checkPositiveSettings(config)];
  if (!isShare(config.weights?.litGlass?.reasonAbove)) {
    problems.push('weights.litGlass.reasonAbove must be a number from 0 to 1');
  }
  return problems;
}

/** Carry-over is smaller than a same-night contribution (R18). */
function checkCarryOverSmaller(config) {
  return mustBeBelow(config, 'carryOver', 'wind');
}

/** Level names used by the caps and floors must be real levels. */
function checkLevels(config) {
  const named = {
    'weatherOnly.floorLevel': config.weatherOnly?.floorLevel,
    'weatherOnly.capLevel': config.weatherOnly?.capLevel,
    missingMigrationCap: config.missingMigrationCap,
  };
  return Object.entries(named)
    .filter(([, level]) => !LEVELS.includes(level))
    .map(([path]) => `${path} must be one of ${LEVELS.join(', ')}`);
}

/** Rule 5: every reason key a factor can return needs wording in config. */
function checkReasonKeys(config, requiredReasonKeys) {
  const reasons = config.reasons ?? {};
  return requiredReasonKeys
    .filter((key) => typeof reasons[key] !== 'string' || reasons[key].trim() === '')
    .map((key) => `reasons.${key} is missing or empty`);
}

/** Run every rule and return all problems together. */
export function checkAll(config, requiredReasonKeys) {
  return [
    ...checkEvidence(config),
    ...checkWeightValues(config),
    ...checkWeightOrder(config),
    ...checkThresholds(config),
    ...checkNightParts(config),
    ...checkShares(config),
    ...checkPlaceSettings(config),
    ...checkCarryOverSmaller(config),
    ...checkSeasonsAndWind(config),
    ...checkLevels(config),
    ...checkReasonKeys(config, requiredReasonKeys),
  ];
}
