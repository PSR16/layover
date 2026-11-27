/**
 * Risk engine entry points: assessNight, assessPlace and rankPlaces (R9, R25, R31, R33).
 *
 * Risk is a planning heuristic, not a prediction of deaths. It is shown only as
 * low, elevated or high with plain reasons (research rule 9, product rule).
 *
 * createRiskEngine takes the factor lists, so a factor can be added or removed without
 * touching the combine step (R31). The default engine uses the registered factors.
 */
import { combine, COMBINE_REASON_KEYS, levelRank } from './risk-combine.ts';
import { DEFAULT_CONFIG } from './risk-config.ts';
import { mergeConfig } from './risk-config-validate.ts';
import { NIGHT_FACTORS } from './risk-night-factors.ts';
import { PLACE_FACTORS } from './risk-place-factors.ts';
import type {
  Conditions,
  FactorEntry,
  NightFactor,
  Place,
  PlaceFactor,
  RiskConfig,
  RiskConfigOverrides,
  RiskResult,
} from './types.ts';

/** A place with its risk result, as returned by rankPlaces. */
export interface RankedPlace {
  place: Place;
  result: RiskResult;
}

export interface FactorLists {
  nightFactors: NightFactor[];
  placeFactors: PlaceFactor[];
}

function isEmptyObject(value: object | null | undefined): boolean {
  return value === undefined || value === null || Object.keys(value).length === 0;
}

function collectReasonKeys(factors: (NightFactor | PlaceFactor)[]): string[] {
  return [...new Set([...factors.flatMap((factor) => factor.reasonKeys), ...COMBINE_REASON_KEYS])];
}

/** Rank by level (high first), then by internal points, then by id so ties never move (R25). */
function compareRanked(first: RankedPlace, second: RankedPlace): number {
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

function evaluateNight(
  factors: NightFactor[],
  conditions: Conditions,
  config: RiskConfig,
): FactorEntry[] {
  return factors.map((factor) => ({ factor, output: factor.evaluate(conditions, config) }));
}

function evaluatePlace(
  factors: PlaceFactor[],
  place: Place,
  conditions: Conditions,
  config: RiskConfig,
): FactorEntry[] {
  return factors.map((factor) => ({ factor, output: factor.evaluate(place, conditions, config) }));
}

/** A function that gives the default config, or the default with overrides merged and checked. */
function configResolver(requiredReasonKeys: string[]) {
  const defaultConfig = mergeConfig(DEFAULT_CONFIG, {}, { requiredReasonKeys });
  return (overrides?: RiskConfigOverrides): RiskConfig => {
    if (isEmptyObject(overrides)) {
      return defaultConfig;
    }
    return mergeConfig(DEFAULT_CONFIG, overrides, { requiredReasonKeys });
  };
}

/**
 * Build an engine from lists of night and place factors.
 * @param {{ nightFactors: object[], placeFactors: object[] }} factorLists
 */
export function createRiskEngine({ nightFactors, placeFactors }: FactorLists) {
  const requiredReasonKeys = collectReasonKeys([...nightFactors, ...placeFactors]);
  const resolveConfig = configResolver(requiredReasonKeys);

  function assessPlaceWith(place: Place, conditions: Conditions, config: RiskConfig): RiskResult {
    const entries = [
      ...evaluateNight(nightFactors, conditions, config),
      ...evaluatePlace(placeFactors, place, conditions, config),
    ];
    return combine({ entries, conditions, place, config });
  }

  /** Risk for the whole night. The surge decision in spec 4 uses this (research rule 8). */
  function assessNight(conditions: Conditions, overrides?: RiskConfigOverrides): RiskResult {
    const config = resolveConfig(overrides);
    return combine({
      entries: evaluateNight(nightFactors, conditions, config),
      conditions,
      config,
    });
  }

  /** Risk for one building, venue or route on this night. */
  function assessPlace(
    place: Place,
    conditions: Conditions,
    overrides?: RiskConfigOverrides,
  ): RiskResult {
    return assessPlaceWith(place, conditions, resolveConfig(overrides));
  }

  /** Rank places, highest risk first. The input list is not changed. */
  function rankPlaces(
    places: Place[],
    conditions: Conditions,
    overrides?: RiskConfigOverrides,
  ): RankedPlace[] {
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
