/**
 * Map settings in one place (spec 2 R21, design risk 5). The public OpenStreetMap tile server is
 * for light use, which fits a demo. A busier deploy changes TILE_URL to another provider.
 * The attribution text is required by the OpenStreetMap tile usage policy.
 */
export const TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
export const TILE_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
export const MAX_ZOOM = 19;
export const FALLBACK_ZOOM = 12;
