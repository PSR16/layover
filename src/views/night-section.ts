/**
 * The night panel used by both views: selector, board and credits, wired to the selection store
 * and the weather loaders (R27 to R29). Loaders are passed in, so tests need no network.
 * A newer selection always wins over a slower, older request. Changing only the sample migration
 * level redraws the board from the weather already loaded, without a new request or losing focus.
 */
import type { AppContext } from '../context.ts';
import type { ReplayNight, WeatherResult } from '../lib/types.ts';
import type { SelectionState } from '../selection.ts';
import { buildCredits } from '../lib/credits.ts';
import { buildNightModel } from '../lib/night-model.ts';
import { nightScoring, type NightScoring } from '../lib/night-conditions.ts';
import { locationOf } from '../lib/city-config.ts';
import { createCredits } from '../components/credits.ts';
import { TONIGHT_ID } from '../selection.ts';
import { renderNightBoard } from './night-board.ts';
import { createDetails, type DetailsSlots } from './night-details.ts';
import { createNightSelector, createSampleLevelSelector } from './night-selector.ts';
import { createBadge } from '../components/badge.ts';

export type SectionOptions = AppContext & {
  idPrefix?: string;
  /** Called each time the board is drawn, with what the place list needs to score buildings. */
  onScoring?: (scoring: NightScoring) => void;
};
interface Slots {
  board: HTMLElement;
  selector: HTMLElement;
  details: DetailsSlots;
  credits: HTMLElement;
}
interface Loaded {
  nightId: string;
  record: ReplayNight | null;
  weatherResult: WeatherResult;
}
function statusLine(page: Document, text: string) {
  const status = page.createElement('p');
  status.className = 'board-status';
  status.setAttribute('role', 'status');
  status.textContent = text;
  return status;
}

function loadFor({
  state,
  records,
  city,
  loaders,
}: SectionOptions & { state: SelectionState }): Promise<Loaded> {
  const location = locationOf(city);
  const record = records.find((entry) => entry.id === state.nightId) ?? null;
  const request = record
    ? loaders.loadReplayWeather(record, location)
    : loaders.loadTonightWeather(location);
  return request.then((weatherResult) => ({ nightId: state.nightId, record, weatherResult }));
}

function createSlots(page: Document, container: HTMLElement): Slots {
  const [board, selector, credits] = ['div', 'div', 'div'].map((tag) =>
    page.createElement(tag),
  ) as [HTMLElement, HTMLElement, HTMLElement];
  const details = createDetails(page);
  container.replaceChildren(board, selector, details.root, credits);
  return { board, selector, details, credits };
}
interface DrawArguments {
  page: Document;
  slots: Slots;
  options: SectionOptions;
  state: SelectionState;
}
function drawBoard({ page, slots, options, loaded, state }: DrawArguments & { loaded: Loaded }) {
  const { record, weatherResult } = loaded;
  const { city, datasetAttribution } = options;
  const model = buildNightModel({ record, weatherResult, sampleLevel: state.sampleLevel, city });
  renderNightBoard(slots.board, model);
  options.onScoring?.(
    nightScoring({ record, weatherResult, sampleLevel: state.sampleLevel, city }),
  );
  slots.details.badges.replaceChildren(...model.details.map((badge) => createBadge(page, badge)));
  const credits = buildCredits({
    datasetAttribution: model.usesDataset ? datasetAttribution : undefined,
  });
  slots.credits.replaceChildren(...[createCredits(page, credits)].filter((node) => node !== null));
}

function drawSelector({ page, slots, options, state }: DrawArguments) {
  const { records, store, idPrefix } = options;
  const choices = { state, onChange: store.set, idPrefix };
  slots.selector.replaceChildren(
    createNightSelector(page, { ...choices, records, tonightId: TONIGHT_ID }),
  );
  const isTonight = state.nightId === TONIGHT_ID;
  slots.details.level.replaceChildren(
    ...(isTonight ? [createSampleLevelSelector(page, choices)] : []),
  );
}
/**
 * @returns {() => void} stops listening to the selection store
 */
export function mountNightSection(container: HTMLElement, options: SectionOptions): () => void {
  const page = container.ownerDocument;
  const slots = createSlots(page, container);
  let requestNumber = 0;
  let loaded: Loaded | null = null;

  async function refresh(state: SelectionState) {
    requestNumber += 1;
    const mine = requestNumber;
    if (loaded?.nightId === state.nightId) {
      drawBoard({ page, slots, options, loaded, state });
      return;
    }
    drawSelector({ page, slots, options, state });
    slots.board.replaceChildren(statusLine(page, 'Loading weather...'));
    slots.credits.replaceChildren();
    const result = await loadFor({ state, ...options });
    if (mine === requestNumber) {
      loaded = result;
      drawBoard({ page, slots, options, loaded, state });
    }
  }

  const stop = options.store.subscribe(refresh);
  refresh(options.store.get());
  return () => {
    requestNumber += 1;
    stop();
  };
}
