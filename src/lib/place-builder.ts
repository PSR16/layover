/**
 * Turns map buildings and hotspots into places the risk engine can score (spec 2 R16 to R18,
 * R30). A building is scored only when something about it is known: a height, a venue kind from
 * the map, or a hotspot entry. A bare footprint is left out. Whether a building is lit tonight is
 * never an input (R30): `lit` stays unset, and the engine counts an unset place as lit, which is
 * the cautious choice. Pure logic, no DOM or network.
 */
import { lakeDistanceMeters } from './city-config.ts';
import { matchHotspot } from './hotspots.ts';
import type { BuildingRecord, City, Coordinate, Hotspot, Place } from './types.ts';
/** A place ready to score, with what the list and the map need to show it. */
export interface PlaceCandidate {
  place: Place;
  /** The hotspot's name, or the building's name, or undefined for an unnamed building. */
  name?: string;
  coordinate: Coordinate;
  /** The map building, or null for a hotspot the map has no building for. */
  building: BuildingRecord | null;
  hotspot: Hotspot | null;
  /** True when any scored value was set by hand rather than read from the map (spec 2 R7). */
  usesSampleValues: boolean;
}
function withDefined<T extends object>(values: T): T {
  return Object.fromEntries(Object.entries(values).filter(([, value]) => value !== undefined)) as T;
}
function lakeDistanceOf(city: City, coordinate: Coordinate): number | undefined {
  return lakeDistanceMeters(city, coordinate) ?? undefined;
}
function placeFromBuilding(building: BuildingRecord, city: City): Place {
  return withDefined({
    id: building.id,
    kind: building.kind,
    heightMeters: building.heightMeters,
    lakeDistanceMeters: lakeDistanceOf(city, building.centroid),
  });
}
/** The hotspot's hand-set values sit on top of what the map says about the building. */
function placeFromHotspot(hotspot: Hotspot, building: BuildingRecord | null, city: City): Place {
  const coordinate = building?.centroid ?? hotspot.match.near;
  return withDefined({
    id: building?.id ?? hotspot.id,
    kind: hotspot.kind ?? building?.kind,
    heightMeters: building?.heightMeters,
    lakeDistanceMeters: lakeDistanceOf(city, coordinate),
    litGlassArea: hotspot.litGlassShare,
    treeNear: hotspot.treeNear,
    birdSafeTreatment: hotspot.birdSafeTreatment,
  });
}
function hotspotCandidate(
  hotspot: Hotspot,
  building: BuildingRecord | null,
  city: City,
): PlaceCandidate {
  return {
    place: placeFromHotspot(hotspot, building, city),
    name: hotspot.name,
    coordinate: building?.centroid ?? hotspot.match.near,
    building,
    hotspot,
    usesSampleValues: true,
  };
}
function isScorable(building: BuildingRecord): boolean {
  return building.heightMeters !== undefined || building.kind !== undefined;
}
/**
 * Every place worth scoring: each hotspot, then each other building with a known height or kind.
 * A building that matches a hotspot appears once, as the hotspot.
 */
export function buildPlaceCandidates(
  buildings: BuildingRecord[],
  hotspots: Hotspot[],
  city: City,
): PlaceCandidate[] {
  const matched = hotspots.map((hotspot) => ({
    hotspot,
    building: matchHotspot(hotspot, buildings),
  }));
  const takenIds = new Set(matched.flatMap(({ building }) => (building ? [building.id] : [])));
  const fromHotspots = matched.map(({ hotspot, building }) =>
    hotspotCandidate(hotspot, building, city),
  );
  const fromMap = buildings
    .filter((building) => isScorable(building) && !takenIds.has(building.id))
    .map((building): PlaceCandidate => ({
      place: placeFromBuilding(building, city),
      name: building.name,
      coordinate: building.centroid,
      building,
      hotspot: null,
      usesSampleValues: false,
    }));
  return [...fromHotspots, ...fromMap];
}
