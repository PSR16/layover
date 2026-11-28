/** A tiny stand-in for Leaflet that records what the map code asked for. No network, no layout. */
export function createFakeLeaflet() {
  const calls = {
    mapOptions: null as Record<string, unknown> | null,
    tileUrl: '',
    tileOptions: null as Record<string, unknown> | null,
    markers: [] as { position: number[]; button: HTMLElement }[],
    fitBounds: [] as unknown[],
    panTo: [] as unknown[],
    removed: false,
    invalidated: 0,
  };
  const group = {
    addTo: () => group,
    remove: () => undefined,
    clearLayers() {
      calls.markers.length = 0;
    },
  };
  const leaflet = {
    map(_element: HTMLElement, options: Record<string, unknown>) {
      calls.mapOptions = options;
      return {
        setView: () => undefined,
        fitBounds: (...args: unknown[]) => calls.fitBounds.push(args),
        panTo: (...args: unknown[]) => calls.panTo.push(args),
        invalidateSize: () => calls.invalidated++,
        remove: () => {
          calls.removed = true;
        },
      };
    },
    tileLayer(url: string, options: Record<string, unknown>) {
      calls.tileUrl = url;
      calls.tileOptions = options;
      return { addTo: () => ({}), remove: () => undefined };
    },
    layerGroup: () => group,
    divIcon: (options: Record<string, unknown>) => options,
    marker(position: number[], options: { icon: { html: HTMLElement } }) {
      const layer = {
        addTo(target: unknown) {
          if (target === group) {
            calls.markers.push({ position, button: options.icon.html });
          }
          return layer;
        },
        remove: () => undefined,
      };
      return layer;
    },
  };
  return { leaflet, calls };
}
