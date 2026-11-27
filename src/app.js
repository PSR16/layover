/**
 * Starts the app: the frame, the two views and the hash router (R1, R2). Everything the views
 * need arrives in one context object, so tests can start the app with fake weather loaders and no
 * network. main.js calls this with the real page.
 */
import { loadReplayWeather, loadTonightWeather } from './api/weather.js';
import { DEFAULT_CITY_ID, getCity } from './config/city.js';
import { RADAR_ATTRIBUTION, REPLAY_NIGHTS } from './data/replay-nights.js';
import { startRouter } from './router.js';
import { createSelectionStore } from './selection.js';
import { createShell } from './views/app-shell.js';
import { renderOrgView } from './views/org-view.js';
import { renderVolunteerView } from './views/volunteer-view.js';

const VIEWS = { volunteer: renderVolunteerView, org: renderOrgView };
const REAL_LOADERS = {
  loadReplayWeather: (record, location) => loadReplayWeather(record, location),
  loadTonightWeather: (location) => loadTonightWeather(location),
};

/**
 * @param {{ root: HTMLElement, browserWindow: Window, deps?: { loaders?: object, city?: object } }} options
 * @returns {() => void} stops the app
 */
export function startApp({ root, browserWindow, deps = {} }) {
  const context = {
    city: deps.city ?? getCity(DEFAULT_CITY_ID),
    records: REPLAY_NIGHTS,
    store: createSelectionStore(),
    loaders: deps.loaders ?? REAL_LOADERS,
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
