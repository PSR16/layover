/**
 * Live OpenStreetMap buildings from Overpass (spec 2 R11 to R14, R31). Network code lives here.
 *
 * - One request per area, 8 second timeout (assumption), never retried on its own.
 * - The request holds only the area's bounding box. No cookies, no referrer, no user text, no
 *   user location (R13). A browser sends its own User-Agent and ignores one set here, so none is set.
 * - A good answer is saved in `localStorage` under a key that carries the date, so it expires
 *   the next day, and is kept in memory for the session (R11). Failures are never saved, so a
 *   retry asks again.
 * - `fetchOverpass` never throws. It returns a result that says what happened, for the visible
 *   fallback line (R12). `createLiveSource` adapts it to the BuildingSource interface (R31).
 */
import { AREA_BOUNDS, type AreaBounds } from '../config/areas.ts';
import { keepValidBuildings } from '../lib/buildings.ts';
import { LIVE_SOURCE_ID, parseOverpass } from '../lib/overpass-parse.ts';
import type { Area, BuildingSource, SourceLoad } from '../lib/source-types.ts';
import type { BuildingRecord } from '../lib/types.ts';

type FetchFunction = (url: string, init: RequestInit) => Promise<Response>;
type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;
export type OverpassFailure = 'timeout' | 'rate-limit' | 'http' | 'network' | 'invalid' | 'empty';

export interface OverpassOptions {
  fetchFn?: FetchFunction;
  timeoutMs?: number;
  now?: () => Date;
  /** Where good answers are saved. Defaults to `localStorage`; null turns saving off. */
  storage?: StorageLike | null;
  /** Answers kept for this page session, by area. */
  session?: Map<Area, Promise<OverpassResult>>;
  endpoint?: string;
}

export interface OverpassSuccess {
  succeeded: true;
  buildings: BuildingRecord[];
  /** Elements left out because they could not be drawn (R14). */
  dropped: number;
  /** The day the answer was fetched, as YYYY-MM-DD. */
  savedOn: string;
  fromCache: boolean;
}
export interface OverpassError {
  succeeded: false;
  reason: OverpassFailure;
  status?: number;
}
export type OverpassResult = OverpassSuccess | OverpassError;

export const OVERPASS_ENDPOINT = 'https://overpass-api.de/api/interpreter';
export const OVERPASS_TIMEOUT_MS = 8000;
const SERVER_TIMEOUT_SECONDS = 10;
const CACHE_PREFIX = 'layover:overpass:v1';
const ISO_DATE_LENGTH = 10;
const TOO_MANY_REQUESTS = 429;
const VENUE_BUILDINGS = 'stadium|arena|sports_hall|sports_centre';

const sessionAnswers = new Map<Area, Promise<OverpassResult>>();

/** The Overpass query for one box: buildings that have a name, a height or a venue tag. */
export function buildQuery(bounds: AreaBounds): string {
  const box = `${bounds.south},${bounds.west},${bounds.north},${bounds.east}`;
  return (
    `[out:json][timeout:${SERVER_TIMEOUT_SECONDS}];(` +
    `way["building"]["name"](${box});` +
    `way["building"]["height"](${box});` +
    `way["building"~"^(${VENUE_BUILDINGS})$"](${box});` +
    ');out tags geom;'
  );
}

interface Settings {
  fetchFn: FetchFunction;
  timeoutMs: number;
  now: () => Date;
  storage: StorageLike | null;
  session: Map<Area, Promise<OverpassResult>>;
  endpoint: string;
}

function defaultStorage(): StorageLike | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

function withDefaults(options: OverpassOptions): Settings {
  return {
    fetchFn: options.fetchFn ?? globalThis.fetch.bind(globalThis),
    timeoutMs: options.timeoutMs ?? OVERPASS_TIMEOUT_MS,
    now: options.now ?? (() => new Date()),
    storage: options.storage === undefined ? defaultStorage() : options.storage,
    session: options.session ?? sessionAnswers,
    endpoint: options.endpoint ?? OVERPASS_ENDPOINT,
  };
}

function failure(reason: OverpassFailure, status?: number): OverpassError {
  return status === undefined ? { succeeded: false, reason } : { succeeded: false, reason, status };
}

/** A busy server can answer 200 with a runtime error remark and a partial list. */
function hasServerRemark(json: unknown): boolean {
  const remark = (json as { remark?: unknown } | null)?.remark;
  return typeof remark === 'string' && remark.includes('runtime error');
}

async function readAnswer(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return undefined;
  }
}

function toResult(json: unknown, today: string): OverpassResult {
  if (hasServerRemark(json)) {
    return failure('http');
  }
  try {
    const { buildings, dropped } = parseOverpass(json);
    return buildings.length === 0
      ? failure('empty')
      : { succeeded: true, buildings, dropped, savedOn: today, fromCache: false };
  } catch {
    return failure('invalid');
  }
}

async function ask(bounds: AreaBounds, settings: Settings): Promise<OverpassResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), settings.timeoutMs);
  try {
    const response = await settings.fetchFn(settings.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
      body: `data=${encodeURIComponent(buildQuery(bounds))}`,
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
      signal: controller.signal,
    });
    if (!response.ok) {
      return failure(
        response.status === TOO_MANY_REQUESTS ? 'rate-limit' : 'http',
        response.status,
      );
    }
    const json = await readAnswer(response);
    return toResult(json, settings.now().toISOString().slice(0, ISO_DATE_LENGTH));
  } catch (error) {
    const aborted = (error as { name?: string } | null)?.name === 'AbortError';
    return failure(aborted ? 'timeout' : 'network');
  } finally {
    clearTimeout(timer);
  }
}

function cacheKey(area: Area, today: string): string {
  return `${CACHE_PREFIX}:${area}:${today}`;
}

function readCache(area: Area, settings: Settings): OverpassSuccess | null {
  const today = settings.now().toISOString().slice(0, ISO_DATE_LENGTH);
  try {
    const text = settings.storage?.getItem(cacheKey(area, today));
    if (!text) {
      return null;
    }
    const saved = JSON.parse(text) as { buildings?: unknown; dropped?: unknown; savedOn?: unknown };
    if (saved.savedOn !== today || !Array.isArray(saved.buildings)) {
      return null;
    }
    const kept = parseSaved(saved.buildings);
    return kept.length === 0
      ? null
      : { succeeded: true, buildings: kept, dropped: 0, savedOn: today, fromCache: true };
  } catch {
    return null;
  }
}

/** Saved records pass the same checks as a fresh answer, since storage can be edited. */
function parseSaved(buildings: unknown[]): BuildingRecord[] {
  return keepValidBuildings(buildings).buildings;
}

function writeCache(area: Area, result: OverpassSuccess, settings: Settings): void {
  try {
    const { buildings, dropped, savedOn } = result;
    settings.storage?.setItem(
      cacheKey(area, savedOn),
      JSON.stringify({ buildings, dropped, savedOn }),
    );
  } catch {
    // Storage can be full or blocked. The answer still works for this session.
  }
}

async function load(area: Area, settings: Settings): Promise<OverpassResult> {
  const cached = readCache(area, settings);
  if (cached) {
    return cached;
  }
  const result = await ask(AREA_BOUNDS[area], settings);
  if (result.succeeded) {
    writeCache(area, result, settings);
  }
  return result;
}

/**
 * Buildings for one study area. Never throws. A good answer is asked for once per session and
 * once per day; a failure is returned as it is and asked for again on the next call.
 */
export function fetchOverpass(area: Area, options: OverpassOptions = {}): Promise<OverpassResult> {
  const settings = withDefaults(options);
  const known = settings.session.get(area);
  if (known) {
    return known;
  }
  if (!Object.hasOwn(AREA_BOUNDS, area)) {
    return Promise.resolve(failure('invalid'));
  }
  const pending = load(area, settings);
  settings.session.set(area, pending);
  void pending.then((result) => {
    if (!result.succeeded && settings.session.get(area) === pending) {
      settings.session.delete(area);
    }
  });
  return pending;
}

const FAILURE_TEXT: Record<OverpassFailure, string> = {
  timeout: 'OpenStreetMap did not answer in time',
  'rate-limit': 'OpenStreetMap is asking for fewer requests',
  http: 'OpenStreetMap could not answer',
  network: 'Could not reach OpenStreetMap',
  invalid: 'OpenStreetMap sent data that could not be read',
  empty: 'OpenStreetMap had no buildings for this area',
};

/** The live source for the source list (R31). A failure rejects, so `loadBuildings` reports it. */
export function createLiveSource(options: OverpassOptions = {}): BuildingSource {
  return {
    id: LIVE_SOURCE_ID,
    async load(area: Area): Promise<SourceLoad> {
      const result = await fetchOverpass(area, options);
      if (!result.succeeded) {
        throw new Error(FAILURE_TEXT[result.reason]);
      }
      return { buildings: result.buildings, savedOn: result.savedOn, fromCache: result.fromCache };
    },
  };
}
