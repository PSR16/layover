/**
 * The small part of Leaflet that map-view.ts uses. Declaring it here lets tests pass a fake
 * (spec 2 design section 8) and keeps the Leaflet types out of the main bundle.
 */
export type LatLng = [number, number];
export interface LeafletLayer {
  addTo: (target: unknown) => LeafletLayer;
  remove: () => void;
}
export interface LeafletMap {
  setView: (center: LatLng, zoom: number, options?: { animate?: boolean }) => unknown;
  fitBounds: (
    bounds: [LatLng, LatLng],
    options?: { animate?: boolean; padding?: LatLng },
  ) => unknown;
  panTo: (center: LatLng, options?: { animate?: boolean }) => unknown;
  invalidateSize: () => unknown;
  remove: () => void;
}
export interface LeafletModule {
  map: (element: HTMLElement, options: Record<string, unknown>) => LeafletMap;
  tileLayer: (url: string, options: Record<string, unknown>) => LeafletLayer;
  layerGroup: () => LeafletLayer & { clearLayers: () => void };
  divIcon: (options: Record<string, unknown>) => unknown;
  marker: (position: LatLng, options: Record<string, unknown>) => LeafletLayer;
}
