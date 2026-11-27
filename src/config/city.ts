/**
 * City configs (R8). Chicago is the default. A city carries its centre, time zone, optional
 * risk overrides (local calibration, R42) and an optional lake shoreline (R38).
 */
import type { City, Shoreline } from '../lib/types.ts';
import shorelineData from '../data/chicago-shoreline.json';
import { CHICAGO_RISK_LABEL, CHICAGO_RISK_OVERRIDES } from './chicago-risk.ts';

/** The lake shore from OpenStreetMap, simplified (spec 2 R15). Built by tools/build-shoreline.ts. */
const CHICAGO_SHORELINE: Shoreline = {
  source: 'map',
  note: `${shorelineData.header.attribution}. Built ${shorelineData.header.builtOn}, ${shorelineData.header.pointsAfter} points.`,
  points: shorelineData.points,
};
export const CHICAGO: City = {
  id: 'chicago',
  name: 'Chicago, Illinois',
  center: { latitude: 41.88, longitude: -87.63 },
  timeZone: 'America/Chicago',
  riskOverrides: CHICAGO_RISK_OVERRIDES,
  riskLabel: CHICAGO_RISK_LABEL,
  shoreline: CHICAGO_SHORELINE,
};

export const CITIES: Record<string, City> = { [CHICAGO.id]: CHICAGO };
export const DEFAULT_CITY_ID = CHICAGO.id;

/** The city with this id, or the default city when the id is unknown. */
export function getCity(id: unknown): City {
  return typeof id === 'string' && Object.hasOwn(CITIES, id) ? CITIES[id] : CITIES[DEFAULT_CITY_ID];
}
