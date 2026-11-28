/**
 * The ranked place list (spec 2 R19, R22 to R24, R27, R28). Shows the 10 highest-ranked places
 * for the chosen night, "Show more" adds the next 10, and a row opens its detail. Buildings load
 * once; a new night only re-ranks them. Loading, empty and failed states say why and what to do.
 */
import { createCredits } from '../components/credits.ts';
import { createPlaceRow, type PlaceRow } from '../components/place-row.ts';
import { HOTSPOTS } from '../data/hotspots.ts';
import { buildCredits } from '../lib/credits.ts';
import type { NightScoring } from '../lib/night-conditions.ts';
import { buildPlaceCandidates, type PlaceCandidate } from '../lib/place-builder.ts';
import { describePlace } from '../lib/place-description.ts';
import { rankCandidates, type RankedCandidate } from '../lib/place-ranking.ts';
import { buildMarkerSpecs } from '../lib/map-markers.ts';
import { createPlaceSelection, type PlaceSelection } from '../lib/place-selection.ts';
import type { LeafletModule } from '../map/leaflet-types.ts';
import { LIVE_SOURCE_ID } from '../lib/overpass-parse.ts';
import { createLiveLine } from './live-line.ts';
import { createMapPanel, type MapPanel } from './places-map.ts';
import type { MergedBuildings } from '../lib/source-types.ts';
import type { City, Hotspot } from '../lib/types.ts';
export const PAGE_SIZE = 10;
/** Places shown in the volunteer view. */
export const COMPACT_SIZE = 5;
export interface PlacesOptions {
  city: City;
  loadBuildings: () => Promise<MergedBuildings>;
  /** Adds the live OpenStreetMap source after the saved list is on screen (spec 2 R12). */
  loadLiveBuildings?: () => Promise<MergedBuildings>;
  /** The curated sites. Defaults to the list in src/data/hotspots.ts. */
  hotspots?: Hotspot[];
  /** Loads Leaflet when "Show map" is pressed. Defaults to a dynamic import; tests pass a fake. */
  loadLeafletModule?: () => Promise<LeafletModule>;
  /** Read-only top places for the volunteer view: no map, no "Show more" (spec 2 R29). */
  compact?: boolean;
}
export interface PlacesSection {
  /** Score the places for a night. Call again whenever the night changes. */
  update: (scoring: NightScoring) => void;
  stop: () => void;
}
const MESSAGES = {
  loading: 'Loading buildings...',
  none: 'No places score above low for this night. Pick another night.',
  partial:
    'Buildings did not load, so only the known sites are listed. Reload the page to try again.',
};
interface Parts {
  page: Document;
  status: HTMLElement;
  list: HTMLElement;
  live: HTMLElement;
  map: MapPanel | null;
  more: HTMLButtonElement;
  credits: HTMLElement;
}
interface State {
  candidates: PlaceCandidate[] | null;
  scoring: NightScoring | null;
  ranked: RankedCandidate[];
  shown: number;
  selection: PlaceSelection;
  failed: boolean;
  stopped: boolean;
  rows: Map<string, PlaceRow>;
}
function createParts(container: HTMLElement, options: PlacesOptions, state: State): Parts {
  const page = container.ownerDocument;
  const heading = page.createElement('h2');
  heading.className = 'board-title';
  heading.textContent = 'Places to check first';
  const status = page.createElement('div');
  const live = page.createElement('div');
  live.className = 'live-line';
  const list = page.createElement('ul');
  list.className = 'place-list';
  const more = page.createElement('button');
  more.type = 'button';
  more.className = 'place-more';
  more.textContent = 'Show more';
  more.hidden = true;
  const credits = page.createElement('div');
  const { latitude, longitude } = options.city.center;
  const map = options.compact
    ? null
    : createMapPanel(page, {
        center: [latitude, longitude],
        onSelect: (id) => selectFromMap(state, id),
        loadLeafletModule: options.loadLeafletModule,
      });
  const parts = [
    heading,
    ...(map ? [map.element] : []),
    status,
    live,
    list,
    ...(options.compact ? [] : [more]),
    credits,
  ];
  container.replaceChildren(...parts);
  return { page, status, live, list, map, more, credits };
}
function messageNode(page: Document, text: string): HTMLElement {
  const node = page.createElement('p');
  node.className = 'board-status';
  node.setAttribute('role', 'status');
  node.textContent = text;
  return node;
}
function showSelection(state: State, id: string | null) {
  for (const [rowId, row] of state.rows) {
    row.setExpanded(rowId === id);
  }
}
/** A marker was pressed: select the place and bring its row into view. */
function selectFromMap(state: State, id: string) {
  state.selection.select(id);
  state.rows.get(id)?.item.scrollIntoView?.({ block: 'nearest' });
}
function appendRows(parts: Parts, state: State, first: number, last: number) {
  for (const entry of state.ranked.slice(first, last)) {
    const description = describePlace(entry);
    const row = createPlaceRow(parts.page, description, (id) => state.selection.toggle(id));
    state.rows.set(description.id, row);
    parts.list.append(row.item);
  }
  parts.more.hidden = state.shown >= state.ranked.length;
}
function statusTexts(state: State): string[] {
  if (!state.candidates || !state.scoring) {
    return [MESSAGES.loading];
  }
  const texts = state.failed ? [MESSAGES.partial] : [];
  return state.ranked.length === 0 ? [...texts, MESSAGES.none] : texts;
}
function draw(parts: Parts, state: State) {
  state.rows.clear();
  parts.list.replaceChildren();
  parts.status.replaceChildren(...statusTexts(state).map((text) => messageNode(parts.page, text)));
  parts.more.hidden = true;
  appendRows(parts, state, 0, state.shown);
  parts.map?.setMarkers(buildMarkerSpecs(state.ranked.slice(0, state.shown)));
  showSelection(state, state.selection.get());
}
function rank(state: State, pageSize: number) {
  if (!state.candidates || !state.scoring) {
    return;
  }
  const { conditions, overrides } = state.scoring;
  const ranked = rankCandidates(state.candidates, conditions, overrides);
  state.ranked = ranked.filter((entry) => entry.level !== 'low');
  state.shown = pageSize;
  state.selection.select(null);
}
function showMore(parts: Parts, state: State) {
  const first = state.shown;
  state.shown += PAGE_SIZE;
  appendRows(parts, state, first, state.shown);
  parts.map?.setMarkers(buildMarkerSpecs(state.ranked.slice(0, state.shown)));
  const firstNew = state.ranked[first];
  if (firstNew) {
    state.rows.get(describePlace(firstNew).id)?.focus();
  }
}
function pageSizeOf(options: PlacesOptions): number {
  return options.compact ? COMPACT_SIZE : PAGE_SIZE;
}
function applyBuildings(
  parts: Parts,
  state: State,
  options: PlacesOptions,
  buildings: MergedBuildings['buildings'],
) {
  state.failed = buildings.length === 0;
  state.candidates = buildPlaceCandidates(buildings, options.hotspots ?? HOTSPOTS, options.city);
  if (!state.failed) {
    const credits = createCredits(parts.page, buildCredits({ usesBuildingData: true }));
    parts.credits.replaceChildren(...(credits ? [credits] : []));
  }
  if (!state.stopped) {
    rank(state, pageSizeOf(options));
    draw(parts, state);
  }
}
/** The saved list first, then the live source on top of it. A live failure never removes the list. */
function loadInto(parts: Parts, state: State, options: PlacesOptions) {
  const { loadLiveBuildings } = options;
  const startLive = () => {
    if (!loadLiveBuildings || state.stopped) {
      return;
    }
    const line = createLiveLine(
      parts.live,
      loadLiveBuildings,
      (result) => {
        if (
          result.loaded.some((entry) => entry.id === LIVE_SOURCE_ID) &&
          result.buildings.length > 0
        ) {
          applyBuildings(parts, state, options, result.buildings);
        }
      },
      () => state.stopped,
    );
    void line.run();
  };
  options
    .loadBuildings()
    .then((result) => applyBuildings(parts, state, options, result.buildings))
    .catch(() => applyBuildings(parts, state, options, []))
    .then(startLive);
}
export function mountPlacesSection(container: HTMLElement, options: PlacesOptions): PlacesSection {
  const state: State = {
    candidates: null,
    scoring: null,
    ranked: [],
    shown: pageSizeOf(options),
    selection: createPlaceSelection(),
    failed: false,
    stopped: false,
    rows: new Map(),
  };
  const parts = createParts(container, options, state);
  state.selection.subscribe((id) => {
    showSelection(state, id);
    parts.map?.select(id);
  });
  parts.more.addEventListener('click', () => showMore(parts, state));
  draw(parts, state);
  loadInto(parts, state, options);
  return {
    update(scoring) {
      state.scoring = scoring;
      rank(state, pageSizeOf(options));
      draw(parts, state);
    },
    stop() {
      state.stopped = true;
      parts.map?.destroy();
    },
  };
}
