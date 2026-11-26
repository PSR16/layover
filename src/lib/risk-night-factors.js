/**
 * Night factors: each one reads a night's conditions and returns
 * { id, group, points, reasonKey, missing }. Points are internal and never shown (R9).
 * Weights and wording come from the config; evidence IDs are listed per factor (R23).
 * To add a factor, write one more object and add it to NIGHT_FACTORS (R31).
 */
import { factorResult, clampShare } from './risk-factor-result.js';
import { migrationLevel, seasonOf, summarizeWeather, weatherScale } from './risk-inputs.js';

function weightOf(config, name) {
  return config.weights[name].weight;
}

/** Shared view of one night: season, migration level, weather summary, weather scale. */
function readNight(conditions, config) {
  const season = seasonOf(conditions.night, config);
  const level = migrationLevel(conditions.migration, config);
  return {
    season,
    level,
    weather: summarizeWeather(conditions.weather, season, config),
    scale: weatherScale(level, config),
  };
}

function migrationReason(level, config) {
  if (level >= config.migrationBands.heavy) {
    return 'migrationHeavy';
  }
  return level >= config.migrationBands.moderate ? 'migrationModerate' : null;
}

/** Migration level is the largest weight (R10; E1, E3, E5). */
const migrationFactor = {
  id: 'migration',
  group: 'migration',
  evidence: ['E1', 'E3', 'E5'],
  reasonKeys: ['migrationHeavy', 'migrationModerate'],
  evaluate(conditions, config) {
    const level = migrationLevel(conditions.migration, config);
    if (level === undefined) {
      return factorResult('migration', 'migration', 0, { missing: ['migration'] });
    }
    const points = weightOf(config, 'migration') * clampShare(level);
    return factorResult('migration', 'migration', points, {
      reasonKey: migrationReason(level, config),
    });
  },
};

/** Unfavorable wind raises risk, more on heavy nights (R16; E2, E17). */
const windFactor = {
  id: 'wind',
  group: 'weather',
  evidence: ['E2', 'E17'],
  reasonKeys: ['windUnfavorable'],
  evaluate(conditions, config) {
    const { weather, scale } = readNight(conditions, config);
    if (weather.wind === undefined) {
      return factorResult('wind', 'weather', 0, { missing: ['wind'] });
    }
    const points = weightOf(config, 'wind') * weather.wind * scale;
    return factorResult('wind', 'weather', points, {
      reasonKey: weather.wind > 0 ? 'windUnfavorable' : null,
    });
  },
};

/** Wind turning against migrants before dawn adds risk (R17; E4). */
const windShiftFactor = {
  id: 'windShift',
  group: 'weather',
  evidence: ['E4'],
  reasonKeys: ['windShift'],
  evaluate(conditions, config) {
    const { weather, scale } = readNight(conditions, config);
    if (!weather.windShift) {
      return factorResult('windShift', 'weather', 0);
    }
    return factorResult('windShift', 'weather', weightOf(config, 'windShift') * scale, {
      reasonKey: 'windShift',
    });
  },
};

function visibilityReason(season, weather) {
  if (weather.sky === undefined || weather.sky <= 0) {
    return null;
  }
  if (season === 'spring' && weather.lowVisibility > 0) {
    return 'springLowVisibility';
  }
  return weather.lowCloud > 0 ? 'lowCloud' : 'lowVisibility';
}

/**
 * Low visibility or low cloud raises risk (E2). In spring, low visibility roughly triples
 * collisions whatever the migration level, so it ignores the migration scale (E2).
 */
const visibilityFactor = {
  id: 'visibility',
  group: 'weather',
  evidence: ['E2', 'E10', 'E11'],
  reasonKeys: ['springLowVisibility', 'lowCloud', 'lowVisibility'],
  evaluate(conditions, config) {
    const { season, weather, scale } = readNight(conditions, config);
    if (weather.sky === undefined) {
      return factorResult('visibility', 'weather', 0, { missing: ['visibility'] });
    }
    const springIgnoresMigration = season === 'spring' && weather.lowVisibility > 0;
    const points =
      weightOf(config, 'visibility') * weather.sky * (springIgnoresMigration ? 1 : scale);
    return factorResult('visibility', 'weather', points, {
      reasonKey: visibilityReason(season, weather),
    });
  },
};

function qualifiesForCarryOver(previousNight, season, config) {
  const level = migrationLevel(previousNight?.migration, config);
  if (level === undefined || level < config.migrationBands.heavy) {
    return false;
  }
  const weather = summarizeWeather(previousNight.weather, season, config);
  return weather.wind > 0 || weather.sky > 0;
}

/** Heavy migration with rough weather on either of the last 2 nights still matters (R18; E4, E17). */
const carryOverFactor = {
  id: 'carryOver',
  group: 'carryOver',
  evidence: ['E4', 'E17'],
  reasonKeys: ['carryOver'],
  evaluate(conditions, config) {
    const season = seasonOf(conditions.night, config);
    const recent = (conditions.previousNights ?? []).slice(0, 2);
    const qualifies = recent.some((night) => qualifiesForCarryOver(night, season, config));
    if (!qualifies) {
      return factorResult('carryOver', 'carryOver', 0);
    }
    return factorResult('carryOver', 'carryOver', weightOf(config, 'carryOver'), {
      reasonKey: 'carryOver',
    });
  },
};

/** Fall nights carry a higher base risk than spring nights (R19; E5). */
const seasonFactor = {
  id: 'season',
  group: 'season',
  evidence: ['E5'],
  reasonKeys: ['fallSeason'],
  evaluate(conditions, config) {
    if (seasonOf(conditions.night, config) !== 'fall') {
      return factorResult('season', 'season', 0);
    }
    return factorResult('season', 'season', weightOf(config, 'fallBonus'), {
      reasonKey: 'fallSeason',
    });
  },
};

export const NIGHT_FACTORS = [
  migrationFactor,
  windFactor,
  windShiftFactor,
  visibilityFactor,
  carryOverFactor,
  seasonFactor,
];

/** Every reason key the night factors can return, for the config validator (rule 5). */
export const NIGHT_REASON_KEYS = NIGHT_FACTORS.flatMap((factor) => factor.reasonKeys);
