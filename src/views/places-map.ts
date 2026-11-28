/**
 * The map under the place list heading (spec 2 R21, R25, R28). Nothing is downloaded until the
 * person presses "Show map". The button then hides and shows the map. If Leaflet cannot load, the
 * panel says so and the list keeps working.
 */
import type { MarkerSpec } from '../lib/map-markers.ts';
import { loadLeaflet } from '../map/load-leaflet.ts';
import type { LatLng, LeafletModule } from '../map/leaflet-types.ts';
import { createMapView, type MapView } from '../map/map-view.ts';
export interface MapPanelOptions {
  center: LatLng;
  onSelect: (id: string) => void;
  /** Defaults to the real, dynamically imported Leaflet. Tests pass a fake. */
  loadLeafletModule?: () => Promise<LeafletModule>;
}
export interface MapPanel {
  element: HTMLElement;
  setMarkers: (specs: MarkerSpec[]) => void;
  select: (id: string | null) => void;
  destroy: () => void;
}
const TEXT = {
  show: 'Show map',
  hide: 'Hide map',
  loading: 'Loading map...',
  failed: 'Could not load the map. The list still works. Press Show map to try again.',
};
function prefersReducedMotion(page: Document): boolean {
  const view = page.defaultView;
  return Boolean(view?.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
}
interface PanelState {
  view: MapView | null;
  markers: MarkerSpec[];
  selectedId: string | null;
  loading: boolean;
  destroyed: boolean;
}
interface PanelParts {
  button: HTMLButtonElement;
  status: HTMLElement;
  canvas: HTMLElement;
}
function createParts(page: Document): PanelParts {
  const button = page.createElement('button');
  button.type = 'button';
  button.className = 'map-toggle';
  button.textContent = TEXT.show;
  button.setAttribute('aria-expanded', 'false');
  const status = page.createElement('p');
  status.className = 'board-status';
  status.setAttribute('aria-live', 'polite');
  status.hidden = true;
  const canvas = page.createElement('div');
  canvas.className = 'map-canvas';
  canvas.hidden = true;
  return { button, status, canvas };
}
function setStatus(parts: PanelParts, text: string) {
  parts.status.textContent = text;
  parts.status.hidden = text === '';
}
function showCanvas(parts: PanelParts, state: PanelState, visible: boolean) {
  parts.canvas.hidden = !visible;
  parts.button.textContent = visible ? TEXT.hide : TEXT.show;
  parts.button.setAttribute('aria-expanded', String(visible));
  if (visible) {
    state.view?.refresh();
  }
}
async function open(
  page: Document,
  parts: PanelParts,
  state: PanelState,
  options: MapPanelOptions,
) {
  state.loading = true;
  setStatus(parts, TEXT.loading);
  try {
    const leaflet = await (options.loadLeafletModule ?? loadLeaflet)();
    if (state.destroyed) {
      return;
    }
    showCanvas(parts, state, true);
    state.view = createMapView({
      leaflet,
      container: parts.canvas,
      center: options.center,
      reducedMotion: prefersReducedMotion(page),
      onSelect: options.onSelect,
    });
    state.view.setMarkers(state.markers);
    state.view.select(state.selectedId);
    setStatus(parts, '');
  } catch {
    setStatus(parts, TEXT.failed);
  } finally {
    state.loading = false;
  }
}
export function createMapPanel(page: Document, options: MapPanelOptions): MapPanel {
  const element = page.createElement('div');
  element.className = 'map-panel';
  const parts = createParts(page);
  element.append(parts.button, parts.status, parts.canvas);
  const state: PanelState = {
    view: null,
    markers: [],
    selectedId: null,
    loading: false,
    destroyed: false,
  };
  parts.button.addEventListener('click', () => {
    if (state.loading) {
      return;
    }
    if (state.view) {
      showCanvas(parts, state, Boolean(parts.canvas.hidden));
      return;
    }
    void open(page, parts, state, options);
  });
  return {
    element,
    setMarkers(specs) {
      state.markers = specs;
      state.view?.setMarkers(specs);
    },
    select(id) {
      state.selectedId = id;
      state.view?.select(id);
    },
    destroy() {
      state.destroyed = true;
      state.view?.destroy();
      state.view = null;
    },
  };
}
