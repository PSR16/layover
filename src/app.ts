/**
 * Starts the app: the frame, the two views and the hash router (R1, R2). Everything the views
 * need arrives in one context object, so tests can start the app with fake weather loaders and no
 * network. main.ts calls this with the real page.
 */
import type { AppContext, WeatherLoaders } from './context.ts';
import { loadAllAreas, staticSource } from './api/sources.ts';
import { loadReplayWeather, loadTonightWeather } from './api/weather.ts';
import { DEFAULT_CITY_ID, getCity } from './config/city.ts';
import { RADAR_ATTRIBUTION, REPLAY_NIGHTS } from './data/replay-nights.ts';
import type { City } from './lib/types.ts';
import { startRouter } from './router.ts';
import { createSelectionStore } from './selection.ts';
import { createShell } from './views/app-shell.ts';
import { renderOrgView } from './views/org-view.ts';
import { renderVolunteerView } from './views/volunteer-view.ts';

const VIEWS = { volunteer: renderVolunteerView, org: renderOrgView };
const REAL_LOADERS: WeatherLoaders = {
  loadReplayWeather: (record, location) => loadReplayWeather(record, location),
  loadTonightWeather: (location) => loadTonightWeather(location),
};

/**
 * @param {{ root: HTMLElement, browserWindow: Window, deps?: { loaders?: object, city?: object } }} options
 * @returns {() => void} stops the app
 */
export interface AppOptions {
  root: HTMLElement;
  browserWindow: Window;
  deps?: {
    loaders?: WeatherLoaders;
    city?: City;
    loadBuildings?: AppContext['loadBuildings'];
    loadLiveBuildings?: AppContext['loadLiveBuildings'];
  };
}
export function startApp({ root, browserWindow, deps = {} }: AppOptions): () => void {
  const context: AppContext = {
    city: deps.city ?? getCity(DEFAULT_CITY_ID),
    records: REPLAY_NIGHTS,
    store: createSelectionStore(),
    loaders: deps.loaders ?? REAL_LOADERS,
    loadBuildings: deps.loadBuildings ?? (() => loadAllAreas([staticSource])),
    loadLiveBuildings:
      deps.loadLiveBuildings ?? (deps.loadBuildings ? undefined : () => loadAllAreas()),
    datasetAttribution: RADAR_ATTRIBUTION,
  };
  const shell = createShell(root);
  let cleanup = () => {};
  const stopRouter = startRouter({
    browserWindow,
    onRoute(route) {
      cleanup();
      shell.showRoute(route.name);
      cleanup = VIEWS[route.name](shell.main, context) ?? (() => {});
    },
  });
  return () => {
    cleanup();
    stopRouter();
  };
}
