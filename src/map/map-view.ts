/**
 * The Leaflet map (spec 2 R21, R22, R25, R26, R27). The Leaflet module is passed in, so the app
 * loads it on demand and tests give it a fake. OpenStreetMap tiles with the attribution always
 * on, text markers that show the risk word, and no animation when the user asked for less motion.
 * Marker text is set with textContent, never as markup.
 */
import { FALLBACK_ZOOM, MAX_ZOOM, TILE_ATTRIBUTION, TILE_URL } from '../config/map.ts';
import { markerBounds, type MarkerSpec } from '../lib/map-markers.ts';
import type { LatLng, LeafletLayer, LeafletMap, LeafletModule } from './leaflet-types.ts';
export interface MapViewOptions {
  leaflet: LeafletModule;
  container: HTMLElement;
  /** Where the map opens before any marker exists. */
  center: LatLng;
  reducedMotion: boolean;
  onSelect: (id: string) => void;
}
export interface MapView {
  setMarkers: (specs: MarkerSpec[]) => void;
  /** Mark one place as selected and bring it into view, or clear with null. */
  select: (id: string | null) => void;
  /** Call after the container changes size or is shown again. */
  refresh: () => void;
  destroy: () => void;
}
function createMarkerButton(page: Document, spec: MarkerSpec, onSelect: (id: string) => void) {
  const button = page.createElement('button');
  button.type = 'button';
  button.className = `map-marker risk-${spec.level}`;
  button.textContent = spec.text;
  button.setAttribute('aria-label', spec.label);
  button.addEventListener('click', () => onSelect(spec.id));
  return button;
}
function createMap(options: MapViewOptions): LeafletMap {
  const { leaflet, container, center, reducedMotion } = options;
  const map = leaflet.map(container, {
    zoomControl: true,
    attributionControl: true,
    keyboard: true,
    zoomAnimation: !reducedMotion,
    fadeAnimation: !reducedMotion,
    markerZoomAnimation: !reducedMotion,
    inertia: !reducedMotion,
  });
  map.setView(center, FALLBACK_ZOOM, { animate: false });
  leaflet.tileLayer(TILE_URL, { attribution: TILE_ATTRIBUTION, maxZoom: MAX_ZOOM }).addTo(map);
  return map;
}
const MARKER_SIZE = 44;
const FIT_PADDING_PIXELS = 64;
const FIT_PADDING: LatLng = [FIT_PADDING_PIXELS, FIT_PADDING_PIXELS];
interface Layers {
  group: LeafletLayer & { clearLayers: () => void };
  buttons: Map<string, HTMLButtonElement>;
  positions: Map<string, LatLng>;
}
function addMarker(options: MapViewOptions, layers: Layers, spec: MarkerSpec) {
  const { leaflet, container, onSelect } = options;
  const button = createMarkerButton(container.ownerDocument, spec, onSelect);
  const icon = leaflet.divIcon({
    html: button,
    className: 'map-marker-icon',
    iconSize: [MARKER_SIZE, MARKER_SIZE],
  });
  const position: LatLng = [spec.latitude, spec.longitude];
  leaflet.marker(position, { icon, keyboard: false }).addTo(layers.group);
  layers.buttons.set(spec.id, button);
  layers.positions.set(spec.id, position);
}
function markSelected(layers: Layers, selectedId: string | null) {
  for (const [id, button] of layers.buttons) {
    button.classList.toggle('map-marker-selected', id === selectedId);
    button.setAttribute('aria-pressed', String(id === selectedId));
  }
}
export function createMapView(options: MapViewOptions): MapView {
  const animate = !options.reducedMotion;
  const map = createMap(options);
  const layers: Layers = {
    group: options.leaflet.layerGroup(),
    buttons: new Map(),
    positions: new Map(),
  };
  layers.group.addTo(map);
  let selectedId: string | null = null;
  return {
    setMarkers(specs) {
      layers.group.clearLayers();
      layers.buttons.clear();
      layers.positions.clear();
      for (const spec of specs) {
        addMarker(options, layers, spec);
      }
      const bounds = markerBounds(specs);
      if (bounds) {
        map.fitBounds(bounds, { animate, padding: FIT_PADDING });
      }
      markSelected(layers, selectedId);
    },
    select(id) {
      selectedId = id;
      markSelected(layers, id);
      const position = id === null ? undefined : layers.positions.get(id);
      if (position) {
        map.panTo(position, { animate });
      }
    },
    refresh: () => map.invalidateSize(),
    destroy: () => map.remove(),
  };
}
