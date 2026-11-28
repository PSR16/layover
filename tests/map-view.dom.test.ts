// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest';
import { createMapView } from '../src/map/map-view.ts';
import { TILE_ATTRIBUTION, TILE_URL } from '../src/config/map.ts';
import { createFakeLeaflet } from './helpers/fake-leaflet.ts';
const specs = [
  {
    id: 'a',
    latitude: 41.8,
    longitude: -87.6,
    level: 'high',
    text: 'High',
    label: 'Alpha, high risk',
  },
  {
    id: 'b',
    latitude: 41.9,
    longitude: -87.7,
    level: 'elevated',
    text: 'Elevated',
    label: 'Beta, elevated risk',
  },
] as const;
let container: HTMLElement;
beforeEach(() => {
  document.body.innerHTML = '<div id="map"></div>';
  container = document.querySelector('#map')!;
});
function mount(reducedMotion = false, onSelect: (id: string) => void = () => undefined) {
  const fake = createFakeLeaflet();
  const view = createMapView({
    leaflet: fake.leaflet as never,
    container,
    center: [41.88, -87.63],
    reducedMotion,
    onSelect,
  });
  return { ...fake, view };
}
describe('map view', () => {
  it('uses OpenStreetMap tiles with the attribution switched on', () => {
    const { calls } = mount();
    expect(calls.tileUrl).toBe(TILE_URL);
    expect(calls.tileOptions?.attribution).toBe(TILE_ATTRIBUTION);
    expect(TILE_ATTRIBUTION).toContain('OpenStreetMap');
    expect(calls.mapOptions?.attributionControl).toBe(true);
  });
  it('shows the risk word as text on every marker, with a spoken label', () => {
    const { view, calls } = mount();
    view.setMarkers([...specs]);
    expect(calls.markers.map((marker) => marker.button.textContent)).toEqual(['High', 'Elevated']);
    expect(calls.markers[0].button.getAttribute('aria-label')).toBe('Alpha, high risk');
    expect(calls.fitBounds).toHaveLength(1);
  });
  it('reports the place when a marker is pressed', () => {
    const pressed: string[] = [];
    const { view, calls } = mount(false, (id) => void pressed.push(id));
    view.setMarkers([...specs]);
    calls.markers[1].button.click();
    expect(pressed).toEqual(['b']);
  });
  it('marks the selected marker and pans to it', () => {
    const { view, calls } = mount();
    view.setMarkers([...specs]);
    view.select('b');
    expect(calls.markers[1].button.classList.contains('map-marker-selected')).toBe(true);
    expect(calls.markers[0].button.classList.contains('map-marker-selected')).toBe(false);
    expect(calls.panTo).toHaveLength(1);
  });
  it('keeps the selection when markers are replaced', () => {
    const { view, calls } = mount();
    view.select('a');
    view.setMarkers([...specs]);
    expect(calls.markers[0].button.getAttribute('aria-pressed')).toBe('true');
  });
  it('turns animation off for reduced motion, and on otherwise', () => {
    const reduced = mount(true);
    expect(reduced.calls.mapOptions).toMatchObject({ zoomAnimation: false, fadeAnimation: false });
    reduced.view.setMarkers([...specs]);
    reduced.view.select('a');
    expect(JSON.stringify(reduced.calls.fitBounds[0])).toContain('"animate":false');
    expect(JSON.stringify(reduced.calls.panTo[0])).toContain('"animate":false');
    expect(mount(false).calls.mapOptions).toMatchObject({ zoomAnimation: true });
  });
  it('removes the map when destroyed', () => {
    const { view, calls } = mount();
    view.destroy();
    expect(calls.removed).toBe(true);
  });
});
