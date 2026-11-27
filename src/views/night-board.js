/**
 * The departures-board panel for one night: the risk level, the reasons, the conditions in words
 * and the badges that say what is sample, replayed, saved or live. Takes the plain data from
 * src/lib/night-model.js. DOM calls and textContent only, so no data can inject markup (R5).
 */
import { createBadge, createRiskBadge } from '../components/badge.js';

function boardRow(page, label, valueNode) {
  const row = page.createElement('div');
  row.className = 'board-row';
  const term = page.createElement('dt');
  term.textContent = label;
  const detail = page.createElement('dd');
  detail.append(valueNode);
  row.append(term, detail);
  return row;
}

function textNode(page, text) {
  return page.createTextNode(text);
}

function reasonList(page, reasons) {
  const list = page.createElement('ul');
  list.className = 'board-reasons';
  for (const reason of reasons) {
    const item = page.createElement('li');
    item.textContent = reason;
    list.append(item);
  }
  return list;
}

function missingNote(page, missing) {
  const note = page.createElement('p');
  note.className = 'board-missing';
  note.textContent = `Not known tonight: ${missing.join(', ')}. The level uses what is known.`;
  return note;
}

/**
 * @param {HTMLElement} container
 * @param {ReturnType<import('../lib/night-model.js').buildNightModel>} model
 */
export function renderNightBoard(container, model) {
  const page = container.ownerDocument;
  const heading = page.createElement('h3');
  heading.className = 'board-title';
  heading.textContent = model.title;
  const badges = page.createElement('div');
  badges.className = 'board-badges';
  badges.append(...model.badges.map((badge) => createBadge(page, badge)));

  const board = page.createElement('dl');
  board.className = 'board';
  board.append(
    boardRow(page, 'Risk', createRiskBadge(page, model.level)),
    boardRow(page, 'Why', reasonList(page, model.reasons)),
    ...model.rows.map((row) => boardRow(page, row.label, textNode(page, row.value))),
  );
  container.replaceChildren(heading, badges, board);
  if (model.missing.length > 0) {
    container.append(missingNote(page, model.missing));
  }
}
