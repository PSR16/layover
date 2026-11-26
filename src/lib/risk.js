/**
 * Risk engine entry points: assessNight, assessPlace and rankPlaces (R9, R25, R31, R33).
 *
 * Risk is a planning heuristic, not a prediction of deaths. It is shown only as
 * low, elevated or high with plain reasons (research rule 9, product rule).
 *
 * createRiskEngine takes the factor lists, so a factor can be added or removed without
 * touching the combine step (R31). The default engine uses the registered factors.
 */
import { combine, COMBINE_REASON_KEYS, levelRank } from './risk-combine.js';
import { DEFAULT_CONFIG } from './risk-config.js';
import { mergeConfig } from './risk-config-validate.js';
import { NIGHT_FACTORS } from './risk-night-factors.js';
import { PLACE_FACTORS } from './risk-place-factors.js';

function isEmptyObject(value) {
  return value === undefined || value === null || Object.keys(value).length === 0;
}

function collectReasonKeys(factors) {
  return [...new Set([...factors.flatMap((factor) => factor.reasonKeys), ...COMBINE_REASON_KEYS])];
}

/** Rank by level (high first), then by internal points, then by id so ties never move (R25). */
function compareRanked(first, second) {
  const byLevel = levelRank(second.result.level) - levelRank(first.result.level);
  if (byLevel !== 0) {
    return byLevel;
  }
  const byPoints = second.result.internal.totalPoints - first.result.internal.totalPoints;
  if (byPoints !== 0) {
    return byPoints;
  }
  return String(first.place.id).localeCompare(String(second.place.id), 'en');
}

/**
 * Build an engine from lists of night and place factors.
 * @param {{ nightFactors: object[], placeFactors: object[] }} factorLists
 */
export function createRiskEngine({ nightFactors, placeFactors }) {
  const requiredReasonKeys = collectReasonKeys([...nightFactors, ...placeFactors]);
  const defaultConfig = mergeConfig(DEFAULT_CONFIG, {}, { requiredReasonKeys });

  function resolveConfig(overrides) {
    if (isEmptyObject(overrides)) {
      return defaultConfig;
    }
    return mergeConfig(DEFAULT_CONFIG, overrides, { requiredReasonKeys });
  }

  function evaluateNight(conditions, config) {
    return nightFactors.map((factor) => ({ factor, output: factor.evaluate(conditions, config) }));
  }

  function evaluatePlace(place, conditions, config) {
    return placeFactors.map((factor) => ({
      factor,
      output: factor.evaluate(place, conditions, config),
    }));
  }

  function assessPlaceWith(place, conditions, config) {
    const entries = [
      ...evaluateNight(conditions, config),
      ...evaluatePlace(place, conditions, config),
    ];
    return combine({ entries, conditions, place, config });
  }

  /** Risk for the whole night. The surge decision in spec 4 uses this (research rule 8). */
  function assessNight(conditions, overrides) {
    const config = resolveConfig(overrides);
    return combine({ entries: evaluateNight(conditions, config), conditions, config });
  }

  /** Risk for one building, venue or route on this night. */
  function assessPlace(place, conditions, overrides) {
    return assessPlaceWith(place, conditions, resolveConfig(overrides));
  }

  /** Rank places, highest risk first. The input list is not changed. */
  function rankPlaces(places, conditions, overrides) {
    const config = resolveConfig(overrides);
    return places
      .map((place) => ({ place, result: assessPlaceWith(place, conditions, config) }))
      .sort(compareRanked);
  }

  return { assessNight, assessPlace, rankPlaces };
}

export const { assessNight, assessPlace, rankPlaces } = createRiskEngine({
  nightFactors: NIGHT_FACTORS,
  placeFactors: PLACE_FACTORS,
});
