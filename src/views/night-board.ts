/**
 * The answer for one night: the risk word first and largest, then the plain reasons, the
 * conditions in words, and the two labels that say what is sample, replayed, saved or live.
 * Takes plain data from src/lib/night-model.ts. DOM calls and textContent only (R5).
 */
import { createBadge } from '../components/badge.ts';
import { riskWord } from '../lib/data-labels.ts';
import type { NightModel } from '../lib/night-model.ts';
import type { Badge } from '../lib/types.ts';
function riskAnswer(page: Document, model: NightModel) {
  const answer = page.createElement('p');
  answer.className = 'risk-answer';
  const word = page.createElement('span');
  word.className = `risk-word risk-${model.level}`;
  word.textContent = riskWord(model.level);
  answer.append(word, ' risk');
  return answer;
}
function reasonList(page: Document, reasons: string[]) {
  const list = page.createElement('ul');
  list.className = 'board-reasons';
  for (const reason of reasons) {
    const item = page.createElement('li');
    item.textContent = reason;
    list.append(item);
  }
  return list;
}
function conditionList(page: Document, rows: NightModel['rows']) {
  const list = page.createElement('dl');
  list.className = 'conditions';
  for (const { label, value } of rows) {
    const term = page.createElement('dt');
    term.textContent = label;
    const detail = page.createElement('dd');
    detail.textContent = value;
    list.append(term, detail);
  }
  return list;
}
function missingNote(page: Document, missing: string[]) {
  const note = page.createElement('p');
  note.className = 'board-missing';
  note.textContent = `Not known tonight: ${missing.join(', ')}. The level uses what is known.`;
  return note;
}
/**
 * @param {HTMLElement} container
 * @param {NightModel} model
 */
export function renderNightBoard(container: HTMLElement, model: NightModel): void {
  const page = container.ownerDocument;
  const heading = page.createElement('h2');
  heading.className = 'board-title';
  heading.textContent = model.title;
  const board = page.createElement('div');
  board.className = 'board';
  board.append(
    riskAnswer(page, model),
    reasonList(page, model.reasons),
    conditionList(page, model.rows),
  );
  const badges = page.createElement('div');
  badges.className = 'board-badges';
  badges.append(...model.badges.map((badge: Badge) => createBadge(page, badge)));
  container.replaceChildren(heading, board, badges);
  if (model.missing.length > 0) {
    container.append(missingNote(page, model.missing));
  }
}
