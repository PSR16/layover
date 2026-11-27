/**
 * Checks for building records from any map source (spec 2 R3, R4, R14). A record that fails is
 * dropped, never drawn. Missing optional values stay missing; nothing here fills one in.
 * Pure logic, no DOM or network.
 */
import type { BuildingRecord } from './types.ts';
const MIN_RING_POINTS = 4;
const MAX_LATITUDE = 90;
const MAX_LONGITUDE = 180;
type Loose = Record<string, unknown>;
function isRecord(value: unknown): value is Loose {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function isCoordinatePair(value: unknown): boolean {
  if (!Array.isArray(value) || value.length !== 2) {
    return false;
  }
  const [longitude, latitude] = value as unknown[];
  return (
    typeof longitude === 'number' &&
    typeof latitude === 'number' &&
    Number.isFinite(longitude) &&
    Number.isFinite(latitude) &&
    Math.abs(longitude) <= MAX_LONGITUDE &&
    Math.abs(latitude) <= MAX_LATITUDE
  );
}
function footprintProblems(footprint: unknown): string[] {
  if (!Array.isArray(footprint) || footprint.length < MIN_RING_POINTS) {
    return ['footprint needs at least 4 points'];
  }
  if (!footprint.every(isCoordinatePair)) {
    return ['footprint has a point that is not a finite [longitude, latitude]'];
  }
  const first = footprint[0] as number[];
  const last = footprint.at(-1) as number[];
  return first[0] === last[0] && first[1] === last[1] ? [] : ['footprint is not closed'];
}
function centroidProblems(centroid: unknown): string[] {
  if (!isRecord(centroid)) {
    return ['centroid is missing'];
  }
  return isCoordinatePair([centroid.longitude, centroid.latitude])
    ? []
    : ['centroid is not a finite latitude and longitude'];
}
function optionalProblems(building: Loose): string[] {
  const problems: string[] = [];
  const { heightMeters, name, kind } = building;
  if (heightMeters !== undefined && !(typeof heightMeters === 'number' && heightMeters > 0)) {
    problems.push('heightMeters must be a positive number when present');
  }
  if (name !== undefined && typeof name !== 'string') {
    problems.push('name must be text when present');
  }
  if (kind !== undefined && typeof kind !== 'string') {
    problems.push('kind must be text when present');
  }
  return problems;
}
function labelProblems(building: Loose): string[] {
  const problems: string[] = [];
  if (typeof building.id !== 'string' || building.id === '') {
    problems.push('id is missing');
  }
  if (building.source !== 'map' && building.source !== 'sample') {
    problems.push('source must be map or sample');
  }
  const { sources } = building;
  if (
    !Array.isArray(sources) ||
    sources.length === 0 ||
    !sources.every((name) => typeof name === 'string')
  ) {
    problems.push('sources must list at least one source name');
  }
  return problems;
}
/** The reasons a record cannot be used. An empty list means it is fine. */
export function validateBuilding(input: unknown): string[] {
  if (!isRecord(input)) {
    return ['building is not an object'];
  }
  return [
    ...labelProblems(input),
    ...footprintProblems(input.footprint),
    ...centroidProblems(input.centroid),
    ...optionalProblems(input),
  ];
}
export function isValidBuilding(input: unknown): input is BuildingRecord {
  return validateBuilding(input).length === 0;
}
/** Keep the valid records and say how many were dropped (spec 2 R14). */
export function keepValidBuildings(inputs: unknown[]): {
  buildings: BuildingRecord[];
  dropped: number;
} {
  const buildings = inputs.filter(isValidBuilding);
  return { buildings, dropped: inputs.length - buildings.length };
}
