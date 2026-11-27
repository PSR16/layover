/**
 * Matching hotspots to map buildings (spec 2 R8). A hotspot matches by building ID first, then by
 * OpenStreetMap ID, then by name and distance. With no match the app still lists the hotspot at
 * its own coordinates. Pure logic, no DOM or network.
 */
import { distanceMeters } from './geo.ts';
import type { BuildingRecord, Hotspot } from './types.ts';
function sameName(first: string | undefined, second: string): boolean {
  return first !== undefined && first.trim().toLowerCase() === second.trim().toLowerCase();
}
function nearestByName(hotspot: Hotspot, buildings: BuildingRecord[]): BuildingRecord | null {
  const { near, maxDistanceMeters } = hotspot.match;
  let best: { building: BuildingRecord; distance: number } | null = null;
  for (const building of buildings) {
    const distance = distanceMeters(near, building.centroid);
    const closer = best === null || distance < best.distance;
    if (sameName(building.name, hotspot.name) && distance <= maxDistanceMeters && closer) {
      best = { building, distance };
    }
  }
  return best?.building ?? null;
}
/** The building for a hotspot, or null when the map has none that fits. */
export function matchHotspot(hotspot: Hotspot, buildings: BuildingRecord[]): BuildingRecord | null {
  const { buildingId, osmId } = hotspot.match;
  const byId = buildingId ? buildings.find((building) => building.id === buildingId) : undefined;
  const byOsm = osmId ? buildings.find((building) => building.osmId === osmId) : undefined;
  return byId ?? byOsm ?? nearestByName(hotspot, buildings);
}
