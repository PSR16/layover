/**
 * Browser side of the hash router (R1, R2). Reads the hash, falls back to #volunteer for an empty
 * or unknown hash (and rewrites the address without adding a history entry), and calls `onRoute`
 * on load and whenever the hash changes.
 */
import { resolveRoute, type Route } from './lib/route.ts';

/**
 * @param {{ browserWindow: Window, onRoute: (route: { name: string, hash: string }) => void }} options
 * @returns {() => void} stops listening
 */
export interface RouterOptions {
  browserWindow: Window;
  onRoute: (route: Route) => void;
}
export function startRouter({ browserWindow, onRoute }: RouterOptions): () => void {
  function handle() {
    const route = resolveRoute(browserWindow.location.hash);
    if (route.isFallback) {
      browserWindow.history.replaceState(null, '', route.hash);
    }
    onRoute(route);
  }
  browserWindow.addEventListener('hashchange', handle);
  handle();
  return () => browserWindow.removeEventListener('hashchange', handle);
}
