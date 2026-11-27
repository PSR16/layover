/**
 * Which view a URL hash points to (R1, R2). `#volunteer` and `#org` are the two views; an empty
 * or unknown hash falls back to `#volunteer`. Pure logic: the browser code lives in src/router.js.
 */

export const ROUTES = ['volunteer', 'org'];
export const DEFAULT_ROUTE = 'volunteer';

/**
 * @param {string | null | undefined} hash the value of location.hash, for example '#org'
 * @returns {{ name: 'volunteer' | 'org', hash: string, isFallback: boolean }}
 */
export function resolveRoute(hash) {
  const name = typeof hash === 'string' && hash.startsWith('#') ? hash.slice(1) : '';
  if (ROUTES.includes(name)) {
    return { name, hash: `#${name}`, isFallback: false };
  }
  return { name: DEFAULT_ROUTE, hash: `#${DEFAULT_ROUTE}`, isFallback: true };
}
