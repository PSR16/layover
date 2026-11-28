/**
 * Turns an Overpass JSON answer into building records (spec 2 R14, R27). Anything that cannot be
 * drawn is dropped and counted, never repaired: no geometry, a non-finite coordinate, an open
 * ring, or an element that is not a way. Missing height, name and kind stay missing, and a
 * height is never guessed from floors. Tag text is kept as plain text for the caller to set with
 * `textContent`. Pure logic, no DOM or network.
 */
import { validateBuilding } from './buildings.ts';
import type { BuildingRecord, RingPoint } from './types.ts';

export const LIVE_SOURCE_ID = 'openstreetmap';
const MAX_NAME_LENGTH = 120;
const METERS_PER_FOOT = 0.3048;
const HEIGHT_DECIMALS = 1;
const MIN_RING_POINTS = 4;
/** OpenStreetMap venue tags that match a kind the risk engine knows (spec 1 R20). */
const KIND_BY_BUILDING_TAG: Record<string, string> = { stadium: 'stadium', arena: 'arena' };

type Loose = Record<string, unknown>;
type Tags = Record<string, string>;

export interface OverpassParseResult {
  buildings: BuildingRecord[];
  /** Elements that were left out because they could not be drawn. */
  dropped: number;
}

function isRecord(value: unknown): value is Loose {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function tagsOf(element: Loose): Tags {
  if (!isRecord(element.tags)) {
    return {};
  }
  return Object.fromEntries(
    Object.entries(element.tags).filter((entry): entry is [string, string] => {
      return typeof entry[1] === 'string';
    }),
  );
}

function ringOf(geometry: unknown): RingPoint[] | null {
  if (!Array.isArray(geometry)) {
    return null;
  }
  const ring: RingPoint[] = [];
  for (const point of geometry as unknown[]) {
    if (!isRecord(point) || typeof point.lat !== 'number' || typeof point.lon !== 'number') {
      return null;
    }
    ring.push([point.lon, point.lat]);
  }
  return ring;
}

function ringCentre(ring: RingPoint[]): { latitude: number; longitude: number } {
  const longitudes = ring.map((point) => point[0]);
  const latitudes = ring.map((point) => point[1]);
  return {
    longitude: (Math.min(...longitudes) + Math.max(...longitudes)) / 2,
    latitude: (Math.min(...latitudes) + Math.max(...latitudes)) / 2,
  };
}

/** Metres from a tag such as "45", "45 m" or "150 ft". Undefined for anything else. */
export function parseHeightMeters(text: string | undefined): number | undefined {
  const match = /^(\d+(?:\.\d+)?) ?(m|ft)?$/i.exec((text ?? '').trim());
  if (!match) {
    return undefined;
  }
  const value = Number(match[1]) * (match[2]?.toLowerCase() === 'ft' ? METERS_PER_FOOT : 1);
  const rounded = Number(value.toFixed(HEIGHT_DECIMALS));
  return rounded > 0 && Number.isFinite(rounded) ? rounded : undefined;
}

function kindOf(tags: Tags): string | undefined {
  const fromBuilding = Object.hasOwn(KIND_BY_BUILDING_TAG, tags.building)
    ? KIND_BY_BUILDING_TAG[tags.building]
    : undefined;
  return fromBuilding ?? (tags.leisure === 'stadium' ? 'stadium' : undefined);
}

function nameOf(tags: Tags): string | undefined {
  const name = tags.name?.trim().slice(0, MAX_NAME_LENGTH);
  return name || undefined;
}

function toRecord(element: unknown): BuildingRecord | null {
  if (!isRecord(element) || element.type !== 'way' || !Number.isSafeInteger(element.id)) {
    return null;
  }
  const ring = ringOf(element.geometry);
  if (!ring || ring.length < MIN_RING_POINTS) {
    return null;
  }
  const tags = tagsOf(element);
  const optional = {
    name: nameOf(tags),
    heightMeters: parseHeightMeters(tags.height),
    kind: kindOf(tags),
  };
  const record: BuildingRecord = {
    id: `osm/way/${String(element.id)}`,
    osmId: `way/${String(element.id)}`,
    footprint: ring,
    centroid: ringCentre(ring),
    source: 'map',
    sources: [LIVE_SOURCE_ID],
    ...Object.fromEntries(Object.entries(optional).filter(([, value]) => value !== undefined)),
  };
  return validateBuilding(record).length === 0 ? record : null;
}

/** Records from an Overpass answer. Throws only when the answer has no `elements` list at all. */
export function parseOverpass(response: unknown): OverpassParseResult {
  if (!isRecord(response) || !Array.isArray(response.elements)) {
    throw new TypeError('Overpass answer has no elements list');
  }
  const buildings: BuildingRecord[] = [];
  const seen = new Set<string>();
  let dropped = 0;
  for (const element of response.elements as unknown[]) {
    const record = toRecord(element);
    if (!record || seen.has(record.id)) {
      dropped += 1;
      continue;
    }
    seen.add(record.id);
    buildings.push(record);
  }
  return { buildings, dropped };
}
