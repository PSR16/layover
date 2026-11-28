/**
 * Loads Leaflet and its stylesheet on demand, so the first screen does not carry them (spec 2
 * design section 6). Only called when someone presses "Show map".
 */
import type { LeafletModule } from './leaflet-types.ts';
export async function loadLeaflet(): Promise<LeafletModule> {
  const [leaflet] = await Promise.all([import('leaflet'), import('leaflet/dist/leaflet.css')]);
  return (leaflet.default ?? leaflet) as unknown as LeafletModule;
}
