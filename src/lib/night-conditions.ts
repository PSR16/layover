/**
 * What the place list needs to score buildings for the night on screen (spec 2 R17, R20): the
 * engine's conditions and the city's overrides, built the same way as the night panel builds
 * them, so the list and the panel never disagree. Pure logic, no DOM or network.
 */
import { overridesFor, sampleMigration, DEFAULT_SAMPLE_LEVEL } from './night-model.ts';
import type { City, Conditions, ReplayNight, RiskConfigOverrides, WeatherResult } from './types.ts';
export interface NightScoring {
  conditions: Conditions;
  overrides: RiskConfigOverrides;
}
interface NightScoringInput {
  record: ReplayNight | null;
  weatherResult: WeatherResult;
  sampleLevel?: string;
  city?: City;
}
export function nightScoring({
  record,
  weatherResult,
  sampleLevel = DEFAULT_SAMPLE_LEVEL,
  city,
}: NightScoringInput): NightScoring {
  const night = record ? record.night : (weatherResult.night ?? '');
  const migration = record ? record.migration : sampleMigration(sampleLevel);
  return {
    conditions: { night, migration, weather: weatherResult.weather },
    overrides: overridesFor(city, weatherResult),
  };
}
