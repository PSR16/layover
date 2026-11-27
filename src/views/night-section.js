/**
 * The night panel used by both views: selector, board and credits, wired to the selection store
 * and the weather loaders (R27 to R29). Loaders are passed in, so tests need no network.
 * A newer selection always wins over a slower, older request. Changing only the sample migration
 * level redraws the board from the weather already loaded, without a new request or losing focus.
 */
import { buildCredits } from '../lib/credits.js';
import { buildNightModel } from '../lib/night-model.js';
import { locationOf } from '../lib/city-config.js';
import { createCredits } from '../components/credits.js';
import { TONIGHT_ID } from '../selection.js';
import { renderNightBoard } from './night-board.js';
import { createNightSelector } from './night-selector.js';

function statusLine(page, text) {
  const status = page.createElement('p');
  status.className = 'board-status';
  status.setAttribute('role', 'status');
  status.textContent = text;
  return status;
}

function loadFor({ state, records, city, loaders }) {
  const location = locationOf(city);
  const record = records.find((entry) => entry.id === state.nightId) ?? null;
  const request = record
    ? loaders.loadReplayWeather(record, location)
    : loaders.loadTonightWeather(location);
  return request.then((weatherResult) => ({ nightId: state.nightId, record, weatherResult }));
}

function createSlots(page, container) {
  const [selector, board, credits] = ['div', 'div', 'div'].map((tag) => page.createElement(tag));
  container.replaceChildren(selector, board, credits);
  return { selector, board, credits };
}

function drawBoard({ page, slots, options, loaded, state }) {
  const { record, weatherResult } = loaded;
  const { city, datasetAttribution } = options;
  const model = buildNightModel({ record, weatherResult, sampleLevel: state.sampleLevel, city });
  renderNightBoard(slots.board, model);
  const credits = buildCredits({
    datasetAttribution: model.usesDataset ? datasetAttribution : undefined,
  });
  slots.credits.replaceChildren(...[createCredits(page, credits)].filter(Boolean));
}

function drawSelector({ page, slots, options, state }) {
  const { records, store, idPrefix } = options;
  const selector = createNightSelector(page, {
    records,
    state,
    tonightId: TONIGHT_ID,
    onChange: store.set,
    idPrefix,
  });
  slots.selector.replaceChildren(selector);
}

/**
 * @returns {() => void} stops listening to the selection store
 */
export function mountNightSection(container, options) {
  const page = container.ownerDocument;
  const slots = createSlots(page, container);
  let requestNumber = 0;
  let loaded = null;

  async function refresh(state) {
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
