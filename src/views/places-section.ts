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
import type { MergedBuildings } from '../lib/source-types.ts';
import type { City, Hotspot } from '../lib/types.ts';
export const PAGE_SIZE = 10;
export interface PlacesOptions {
  city: City;
  loadBuildings: () => Promise<MergedBuildings>;
  /** The curated sites. Defaults to the list in src/data/hotspots.ts. */
  hotspots?: Hotspot[];
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
  more: HTMLButtonElement;
  credits: HTMLElement;
}
interface State {
  candidates: PlaceCandidate[] | null;
  scoring: NightScoring | null;
  ranked: RankedCandidate[];
  shown: number;
  openId: string | null;
  failed: boolean;
  stopped: boolean;
  rows: Map<string, PlaceRow>;
}
function createParts(container: HTMLElement): Parts {
  const page = container.ownerDocument;
  const heading = page.createElement('h2');
  heading.className = 'board-title';
  heading.textContent = 'Places to check first';
  const status = page.createElement('div');
  const list = page.createElement('ul');
  list.className = 'place-list';
  const more = page.createElement('button');
  more.type = 'button';
  more.className = 'place-more';
  more.textContent = 'Show more';
  more.hidden = true;
  const credits = page.createElement('div');
  container.replaceChildren(heading, status, list, more, credits);
  return { page, status, list, more, credits };
}
function messageNode(page: Document, text: string): HTMLElement {
  const node = page.createElement('p');
  node.className = 'board-status';
  node.setAttribute('role', 'status');
  node.textContent = text;
  return node;
}
function toggleRow(state: State, id: string) {
  state.openId = state.openId === id ? null : id;
  for (const [rowId, row] of state.rows) {
    row.setExpanded(rowId === state.openId);
  }
}
function appendRows(parts: Parts, state: State, first: number, last: number) {
  for (const entry of state.ranked.slice(first, last)) {
    const description = describePlace(entry);
    const row = createPlaceRow(parts.page, description, (id) => toggleRow(state, id));
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
}
function rank(state: State) {
  if (!state.candidates || !state.scoring) {
    return;
  }
  const { conditions, overrides } = state.scoring;
  const ranked = rankCandidates(state.candidates, conditions, overrides);
  state.ranked = ranked.filter((entry) => entry.level !== 'low');
  state.shown = PAGE_SIZE;
  state.openId = null;
}
function showMore(parts: Parts, state: State) {
  const first = state.shown;
  state.shown += PAGE_SIZE;
  appendRows(parts, state, first, state.shown);
  const firstNew = state.ranked[first];
  if (firstNew) {
    state.rows.get(describePlace(firstNew).id)?.focus();
  }
}
function loadInto(parts: Parts, state: State, options: PlacesOptions) {
  const settle = (buildings: MergedBuildings['buildings'], failed: boolean) => {
    state.failed = failed;
    state.candidates = buildPlaceCandidates(buildings, options.hotspots ?? HOTSPOTS, options.city);
    if (!failed) {
      const credits = createCredits(parts.page, buildCredits({ usesBuildingData: true }));
      parts.credits.replaceChildren(...(credits ? [credits] : []));
    }
    if (!state.stopped) {
      rank(state);
      draw(parts, state);
    }
  };
  options
    .loadBuildings()
    .then((result) => settle(result.buildings, result.buildings.length === 0))
    .catch(() => settle([], true));
}
export function mountPlacesSection(container: HTMLElement, options: PlacesOptions): PlacesSection {
  const parts = createParts(container);
  const state: State = {
    candidates: null,
    scoring: null,
    ranked: [],
    shown: PAGE_SIZE,
    openId: null,
    failed: false,
    stopped: false,
    rows: new Map(),
  };
  parts.more.addEventListener('click', () => showMore(parts, state));
  draw(parts, state);
  loadInto(parts, state, options);
  return {
    update(scoring) {
      state.scoring = scoring;
      rank(state);
      draw(parts, state);
    },
    stop() {
      state.stopped = true;
    },
  };
}
