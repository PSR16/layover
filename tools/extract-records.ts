/**
 * Turns Overture building features into slim building records and picks the ones worth shipping
 * (spec 2 R1, R3, R4). Pure functions, tested in tests/extract-records.test.ts.
 * Nothing is invented: a missing height, name or class stays missing.
 */
import type { BuildingRecord, RingPoint } from '../src/lib/types.ts';
import {
  ringAreaSquareMeters,
  ringCenter,
  roundRing,
  roundTo,
  simplifyRing,
} from './extract-geometry.ts';
export interface OvertureFeature {
  id: string;
  geometry: { type: string; coordinates: unknown };
  properties: {
    names?: { primary?: string | null } | null;
    height?: number | null;
    class?: string | null;
    is_underground?: boolean | null;
    sources?: { dataset?: string; record_id?: string | null }[] | null;
  };
}
export interface ExtractRules {
  /** Simplification tolerance for footprints, in metres. */
  toleranceMeters: number;
  /** Footprints with nothing known about them are kept only at or above this area. */
  minimumBareAreaSquareMeters: number;
}
export const DEFAULT_RULES: ExtractRules = { toleranceMeters: 1, minimumBareAreaSquareMeters: 150 };
const COORDINATE_DECIMALS = 5;
const HEIGHT_DECIMALS = 1;
/** Overture classes that match a venue kind the risk engine knows (spec 1 R20). Others stay unset. */
const KIND_BY_CLASS: Record<string, string> = { stadium: 'stadium', arena: 'arena' };
/** The first ring of each polygon; for a multipolygon, the one with the largest area. */
export function outerRing(geometry: OvertureFeature['geometry']): RingPoint[] | null {
  const { type, coordinates } = geometry;
  if (type === 'Polygon') {
    return (coordinates as RingPoint[][])[0] ?? null;
  }
  if (type !== 'MultiPolygon') {
    return null;
  }
  const rings = (coordinates as RingPoint[][][]).map((polygon) => polygon[0]).filter(Boolean);
  rings.sort((first, second) => ringAreaSquareMeters(second) - ringAreaSquareMeters(first));
  return rings[0] ?? null;
}
const OSM_PREFIX = new Map([
  ['w', 'way'],
  ['r', 'relation'],
  ['n', 'node'],
]);
/** "w95357362@9" becomes "way/95357362". Undefined when the building has no OpenStreetMap source. */
export function osmIdOf(sources: OvertureFeature['properties']['sources']): string | undefined {
  const recordId = sources?.find((source) => source.dataset === 'OpenStreetMap')?.record_id;
  const match = /^([wrn])(\d+)/.exec(recordId ?? '');
  return match ? `${OSM_PREFIX.get(match[1])}/${match[2]}` : undefined;
}
export function kindOf(buildingClass: string | null | undefined): string | undefined {
  return buildingClass ? KIND_BY_CLASS[buildingClass] : undefined;
}
function cleanName(names: OvertureFeature['properties']['names']): string | undefined {
  const name = names?.primary?.trim();
  return name || undefined;
}
function cleanHeight(height: number | null | undefined): number | undefined {
  if (typeof height !== 'number' || !Number.isFinite(height)) {
    return undefined;
  }
  const rounded = roundTo(height, HEIGHT_DECIMALS);
  return rounded > 0 ? rounded : undefined;
}
/** A slim record, or null for an underground building or a shape with no usable ring. */
export function toRecord(feature: OvertureFeature, rules: ExtractRules): BuildingRecord | null {
  const { properties } = feature;
  const ring = outerRing(feature.geometry);
  if (properties.is_underground || !ring || ring.length < 4) {
    return null;
  }
  const footprint = roundRing(simplifyRing(ring, rules.toleranceMeters), COORDINATE_DECIMALS);
  const center = ringCenter(footprint);
  const record: BuildingRecord = {
    id: feature.id,
    footprint,
    centroid: {
      latitude: roundTo(center.latitude, COORDINATE_DECIMALS),
      longitude: roundTo(center.longitude, COORDINATE_DECIMALS),
    },
    source: 'map',
    sources: ['static'],
  };
  const optional = {
    osmId: osmIdOf(properties.sources),
    name: cleanName(properties.names),
    heightMeters: cleanHeight(properties.height),
    kind: kindOf(properties.class),
  };
  return Object.assign(
    record,
    Object.fromEntries(Object.entries(optional).filter(([, value]) => value !== undefined)),
  );
}
/** What is known about a record beyond its footprint. */
export function isKnown(record: BuildingRecord): boolean {
  return (
    record.heightMeters !== undefined || record.kind !== undefined || record.name !== undefined
  );
}
export interface Selection {
  buildings: BuildingRecord[];
  dropped: { unusable: number; smallAndBare: number };
}
/** Keep buildings with something known, and bare footprints that are big enough to show. */
export function selectBuildings(features: OvertureFeature[], rules: ExtractRules): Selection {
  const dropped = { unusable: 0, smallAndBare: 0 };
  const buildings: BuildingRecord[] = [];
  for (const feature of features) {
    const record = toRecord(feature, rules);
    if (!record) {
      dropped.unusable += 1;
    } else if (
      isKnown(record) ||
      ringAreaSquareMeters(record.footprint) >= rules.minimumBareAreaSquareMeters
    ) {
      buildings.push(record);
    } else {
      dropped.smallAndBare += 1;
    }
  }
  buildings.sort((first, second) => first.id.localeCompare(second.id));
  return { buildings, dropped };
}
