/**
 * What the map draws for the places on the list (spec 2 R22, R25). One marker per listed place,
 * carrying the risk word as text so colour is never the only signal. Places without a usable
 * coordinate are left off the map and stay on the list. Pure logic, no DOM, no Leaflet.
 */
import { riskWord } from './data-labels.ts';
import { describePlace } from './place-description.ts';
import type { RankedCandidate } from './place-ranking.ts';
import type { RiskLevel } from './types.ts';
const MAX_LATITUDE = 90;
const MAX_LONGITUDE = 180;
export interface MarkerSpec {
  id: string;
  latitude: number;
  longitude: number;
  level: RiskLevel;
  /** The risk word shown on the marker, for example "High". */
  text: string;
  /** What a screen reader says, for example "Soldier Field, high risk". */
  label: string;
}
export type MapBounds = [[number, number], [number, number]];
function hasUsableCoordinate(entry: RankedCandidate): boolean {
  const { latitude, longitude } = entry.candidate.coordinate;
  return (
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    Math.abs(latitude) <= MAX_LATITUDE &&
    Math.abs(longitude) <= MAX_LONGITUDE
  );
}
export function buildMarkerSpecs(entries: RankedCandidate[]): MarkerSpec[] {
  return entries.filter(hasUsableCoordinate).map((entry) => {
    const place = describePlace(entry);
    const { latitude, longitude } = entry.candidate.coordinate;
    return {
      id: place.id,
      latitude,
      longitude,
      level: place.level,
      text: riskWord(place.level),
      label: `${place.name}, ${place.level} risk`,
    };
  });
}
/** South-west and north-east corners that hold every marker, or null when there are none. */
export function markerBounds(specs: MarkerSpec[]): MapBounds | null {
  if (specs.length === 0) {
    return null;
  }
  const latitudes = specs.map((spec) => spec.latitude);
  const longitudes = specs.map((spec) => spec.longitude);
  return [
    [Math.min(...latitudes), Math.min(...longitudes)],
    [Math.max(...latitudes), Math.max(...longitudes)],
  ];
}
