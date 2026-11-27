/**
 * City configs (R8). Chicago is the default. A city carries its centre, time zone, optional
 * risk overrides (local calibration, R42) and an optional lake shoreline (R38).
 */
import type { City } from '../lib/types.ts';
import { CHICAGO_RISK_LABEL, CHICAGO_RISK_OVERRIDES } from './chicago-risk.ts';

export const CHICAGO: City = {
  id: 'chicago',
  name: 'Chicago, Illinois',
  center: { latitude: 41.88, longitude: -87.63 },
  timeZone: 'America/Chicago',
  riskOverrides: CHICAGO_RISK_OVERRIDES,
  riskLabel: CHICAGO_RISK_LABEL,
  // Coarse Lake Michigan shoreline, south to north, set by hand. It is SAMPLE data, good to a few
  // hundred metres, until spec 2 replaces it with a shoreline from the map data.
  shoreline: {
    source: 'sample',
    note: 'Hand-set coarse shoreline, sample data. Replace with map data in spec 2.',
    points: [
      { latitude: 41.72, longitude: -87.53 },
      { latitude: 41.76, longitude: -87.555 },
      { latitude: 41.79, longitude: -87.58 },
      { latitude: 41.825, longitude: -87.605 },
      { latitude: 41.85, longitude: -87.6105 },
      { latitude: 41.87, longitude: -87.612 },
      { latitude: 41.9, longitude: -87.6145 },
      { latitude: 41.94, longitude: -87.638 },
      { latitude: 41.97, longitude: -87.643 },
      { latitude: 42, longitude: -87.656 },
      { latitude: 42.05, longitude: -87.67 },
    ],
  },
};

export const CITIES: Record<string, City> = { [CHICAGO.id]: CHICAGO };
export const DEFAULT_CITY_ID = CHICAGO.id;

/** The city with this id, or the default city when the id is unknown. */
export function getCity(id: unknown): City {
  return typeof id === 'string' && Object.hasOwn(CITIES, id) ? CITIES[id] : CITIES[DEFAULT_CITY_ID];
}
