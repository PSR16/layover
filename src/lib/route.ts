/**
 * Which view a URL hash points to (R1, R2). `#volunteer` and `#org` are the two views; an empty
 * or unknown hash falls back to `#volunteer`. Pure logic: the browser code lives in src/router.ts.
 */

export const ROUTES = ['volunteer', 'org'] as const;
export type RouteName = (typeof ROUTES)[number];

export interface Route {
  name: RouteName;
  hash: string;
  isFallback: boolean;
}
export const DEFAULT_ROUTE: RouteName = 'volunteer';

/**
 * @param {string | null | undefined} hash the value of location.hash, for example '#org'
 * @returns {{ name: 'volunteer' | 'org', hash: string, isFallback: boolean }}
 */
export function resolveRoute(hash: unknown): Route {
  const name = typeof hash === 'string' && hash.startsWith('#') ? hash.slice(1) : '';
  if (ROUTES.includes(name as RouteName)) {
    return { name: name as RouteName, hash: `#${name}`, isFallback: false };
  }
  return { name: DEFAULT_ROUTE, hash: `#${DEFAULT_ROUTE}`, isFallback: true };
}
