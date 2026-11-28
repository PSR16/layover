/** Bounding boxes of the three study areas, the same boxes the static extracts were cut from (spec 2 R1). */
import type { Area } from '../lib/source-types.ts';

export interface AreaBounds {
  south: number;
  west: number;
  north: number;
  east: number;
}

export const AREA_BOUNDS: Record<Area, AreaBounds> = {
  loop: { west: -87.645, south: 41.872, east: -87.62, north: 41.89 },
  lakefront: { west: -87.63, south: 41.843, east: -87.6, north: 41.868 },
  evanston: { west: -87.685, south: 42.05, east: -87.665, north: 42.062 },
};
