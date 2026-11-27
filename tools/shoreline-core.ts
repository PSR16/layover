/**
 * Builds one shoreline line from OpenStreetMap ways (spec 2 R15). Pure functions, tested in
 * tests/shoreline-core.test.ts. Lake Michigan's shore is not tagged as a coastline, so the ways
 * come from the lake's relation. They join end to end into one long chain, plus some small pieces
 * (harbour walls, piers) that are left out.
 */
import type { Coordinate, RingPoint } from '../src/lib/types.ts';
import { roundTo, simplifyLine } from './extract-geometry.ts';
export interface OsmWay {
  id: number;
  geometry: { lat: number; lon: number }[];
}
const COORDINATE_DECIMALS = 5;
const TOLERANCE_STEP_FACTOR = 1.25;
const MAX_TOLERANCE_METERS = 5000;
const pointKey = (point: { lat: number; lon: number }) => `${point.lat},${point.lon}`;
const isOpen = (way: OsmWay) =>
  way.geometry.length >= 2 && pointKey(way.geometry[0]) !== pointKey(way.geometry.at(-1)!);
/** Ways grouped by the end points they share. Each group is one connected piece of shore. */
function connectedGroups(ways: OsmWay[]): OsmWay[][] {
  const parent = new Map<string, string>();
  const find = (key: string): string => {
    const above = parent.get(key) ?? key;
    if (above === key) {
      return key;
    }
    const root = find(above);
    parent.set(key, root);
    return root;
  };
  for (const way of ways) {
    parent.set(find(pointKey(way.geometry[0])), find(pointKey(way.geometry.at(-1)!)));
  }
  const groups = new Map<string, OsmWay[]>();
  for (const way of ways) {
    const root = find(pointKey(way.geometry[0]));
    groups.set(root, [...(groups.get(root) ?? []), way]);
  }
  return [...groups.values()];
}
type WaysByEnd = Map<string, OsmWay[]>;
function indexByEnd(group: OsmWay[]): WaysByEnd {
  const byEnd: WaysByEnd = new Map();
  for (const way of group) {
    for (const end of [way.geometry[0], way.geometry.at(-1)!]) {
      byEnd.set(pointKey(end), [...(byEnd.get(pointKey(end)) ?? []), way]);
    }
  }
  return byEnd;
}
/** The key of one loose end of a plain chain, or null when the group branches or loops. */
function chainStart(byEnd: WaysByEnd): string | null {
  const attachments = [...byEnd.values()];
  const looseEnds = [...byEnd.entries()].filter(([, attached]) => attached.length === 1);
  const branches = attachments.some((attached) => attached.length > 2);
  return looseEnds.length === 2 && !branches ? looseEnds[0][0] : null;
}
/** The points of a way as [longitude, latitude], turned so it starts at `startKey`. */
function pointsFrom(way: OsmWay, startKey: string): { points: RingPoint[]; endKey: string } {
  const forward = pointKey(way.geometry[0]) === startKey;
  const ordered = forward ? way.geometry : [...way.geometry].reverse();
  return {
    points: ordered.map((point): RingPoint => [point.lon, point.lat]),
    endKey: pointKey(ordered.at(-1)!),
  };
}
/** The ways of one group joined start to end, or null when the group is a branch or a loop. */
function chainGroup(group: OsmWay[]): RingPoint[] | null {
  const byEnd = indexByEnd(group);
  let cursor = chainStart(byEnd);
  if (cursor === null) {
    return null;
  }
  const line: RingPoint[] = [];
  const used = new Set<number>();
  let next: OsmWay | undefined = byEnd.get(cursor)![0];
  while (next && !used.has(next.id)) {
    used.add(next.id);
    const { points, endKey } = pointsFrom(next, cursor);
    line.push(...(line.length > 0 ? points.slice(1) : points));
    cursor = endKey;
    next = byEnd.get(cursor)?.find((way) => !used.has(way.id));
  }
  return used.size === group.length ? line : null;
}
function lineLengthDegrees(line: RingPoint[]): number {
  let total = 0;
  for (let index = 1; index < line.length; index += 1) {
    total += Math.hypot(line[index][0] - line[index - 1][0], line[index][1] - line[index - 1][1]);
  }
  return total;
}
/** The same line, turned so it starts at its southern end. */
export function southToNorth(line: RingPoint[]): RingPoint[] {
  return line[0][1] > line.at(-1)![1] ? [...line].reverse() : line;
}
/** The longest chain of open ways that join end to end, as [longitude, latitude] points. */
export function longestChain(ways: OsmWay[]): RingPoint[] | null {
  const chains = connectedGroups(ways.filter(isOpen))
    .map(chainGroup)
    .filter((chain): chain is RingPoint[] => chain !== null);
  chains.sort((first, second) => lineLengthDegrees(second) - lineLengthDegrees(first));
  return chains[0] ? southToNorth(chains[0]) : null;
}
/** Simplify with the smallest tolerance that leaves at most `maxPoints` points. */
export function simplifyToMaxPoints(line: RingPoint[], maxPoints: number): RingPoint[] {
  let tolerance = 1;
  let result = line;
  while (result.length > maxPoints && tolerance < MAX_TOLERANCE_METERS) {
    result = simplifyLine(line, tolerance);
    tolerance *= TOLERANCE_STEP_FACTOR;
  }
  return result;
}
export function toCoordinates(line: RingPoint[]): Coordinate[] {
  return line.map(([longitude, latitude]) => ({
    latitude: roundTo(latitude, COORDINATE_DECIMALS),
    longitude: roundTo(longitude, COORDINATE_DECIMALS),
  }));
}
