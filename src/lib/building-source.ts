/**
 * Merges building records from several sources (spec 2 R31 to R33). Sources are listed in
 * priority order. A later record that matches an earlier one by OpenStreetMap ID, or by footprint
 * overlap above half of the smaller footprint, only fills fields the earlier record lacks. The
 * merged record lists every source that contributed. Records inside one source are never merged
 * with each other. Pure logic, no DOM or network.
 */
import { boundingBox, boxesTouch, overlapOfSmaller } from './footprint-overlap.ts';
import type { BuildingRecord } from './types.ts';
const OVERLAP_MERGE_THRESHOLD = 0.5;
const FILLABLE_FIELDS = ['osmId', 'name', 'heightMeters', 'kind'] as const;
function sameBuilding(earlier: BuildingRecord, later: BuildingRecord): boolean {
  if (earlier.osmId !== undefined && later.osmId !== undefined) {
    return earlier.osmId === later.osmId;
  }
  return overlapOfSmaller(earlier.footprint, later.footprint) > OVERLAP_MERGE_THRESHOLD;
}
function findMatch(candidates: BuildingRecord[], later: BuildingRecord): number {
  const laterBox = boundingBox(later.footprint);
  return candidates.findIndex(
    (earlier) =>
      (earlier.osmId !== undefined && earlier.osmId === later.osmId) ||
      (boxesTouch(boundingBox(earlier.footprint), laterBox) && sameBuilding(earlier, later)),
  );
}
function unionOf(first: string[], second: string[]): string[] {
  return [...new Set([...first, ...second])];
}
/** The earlier record wins; the later one fills only what is missing. */
export function mergeRecords(earlier: BuildingRecord, later: BuildingRecord): BuildingRecord {
  const merged: BuildingRecord = { ...earlier, sources: unionOf(earlier.sources, later.sources) };
  for (const field of FILLABLE_FIELDS) {
    if (merged[field] === undefined && later[field] !== undefined) {
      Object.assign(merged, { [field]: later[field] });
    }
  }
  if (later.source === 'sample') {
    merged.source = 'sample';
  }
  return merged;
}
function addSource(accumulated: BuildingRecord[], records: BuildingRecord[]): BuildingRecord[] {
  const result = [...accumulated];
  for (const record of records) {
    const index = findMatch(accumulated, record);
    if (index === -1) {
      result.push(record);
    } else {
      result[index] = mergeRecords(result[index], record);
    }
  }
  return result;
}
/** Merge record lists given in priority order (first list wins). */
export function mergeSources(lists: BuildingRecord[][]): BuildingRecord[] {
  return lists.reduce(addSource, []);
}
