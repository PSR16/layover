/** Types for building sources and merging (spec 2 R12, R31, R32). Split from types.ts for the file-size limit. */
import type { BuildingRecord } from './types.ts';
/** The three study areas that have a static building extract (spec 2 R1). */
export type Area = 'loop' | 'lakefront' | 'evanston';
/** What one source gives back for one area (spec 2 R31). */
export interface SourceLoad {
  buildings: BuildingRecord[];
  /** The date the data was saved or built, as YYYY-MM-DD. */
  savedOn: string;
  fromCache: boolean;
}
/** Every building source implements this (spec 2 R31). */
export interface BuildingSource {
  id: string;
  load(area: Area): Promise<SourceLoad>;
}
/** One source that loaded, as reported to the interface (spec 2 R12). */
interface LoadedSource {
  id: string;
  savedOn: string;
  fromCache: boolean;
}
/** One source that failed, with a short reason (spec 2 R12). */
interface FailedSource {
  id: string;
  reason: string;
}
/** Merged buildings plus which sources loaded and which failed (spec 2 R12, R32). */
export interface MergedBuildings {
  buildings: BuildingRecord[];
  loaded: LoadedSource[];
  failed: FailedSource[];
}
