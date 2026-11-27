/**
 * One row of the place list (spec 2 R19, R22, R27). The row is a button that opens the detail
 * under it. Every piece of text, including building names from map data, is set with
 * textContent, so nothing in the data can inject markup.
 */
import type { PlaceDescription } from '../lib/place-description.ts';
import { createBadge, createRiskBadge } from './badge.ts';
export interface PlaceRow {
  item: HTMLLIElement;
  setExpanded: (expanded: boolean) => void;
  focus: () => void;
}
function textElement(page: Document, tag: string, className: string, text: string) {
  const element = page.createElement(tag);
  element.className = className;
  element.textContent = text;
  return element;
}
function createSummary(page: Document, place: PlaceDescription): HTMLButtonElement {
  const button = page.createElement('button');
  button.type = 'button';
  button.className = 'place-button';
  button.setAttribute('aria-expanded', 'false');
  button.append(createRiskBadge(page, place.level));
  button.append(textElement(page, 'span', 'place-name', place.name));
  if (place.heightText) {
    button.append(textElement(page, 'span', 'place-meta', place.heightText));
  }
  if (place.isSample) {
    button.append(createBadge(page, { text: 'Sample data', tone: 'sample' }));
  }
  return button;
}
function createDetail(page: Document, place: PlaceDescription): HTMLElement {
  const detail = page.createElement('div');
  detail.className = 'place-detail';
  detail.hidden = true;
  const reasons = page.createElement('ul');
  reasons.className = 'board-reasons';
  for (const reason of place.reasons) {
    reasons.append(textElement(page, 'li', '', reason));
  }
  detail.append(reasons);
  const notes = [place.hotspotReason, place.lightingNote, place.missingText];
  for (const note of notes) {
    if (note) {
      detail.append(textElement(page, 'p', 'place-note', note));
    }
  }
  return detail;
}
export function createPlaceRow(
  page: Document,
  place: PlaceDescription,
  onToggle: (id: string) => void,
): PlaceRow {
  const item = page.createElement('li');
  item.className = 'place-row';
  item.dataset.placeId = place.id;
  const button = createSummary(page, place);
  const detail = createDetail(page, place);
  button.addEventListener('click', () => onToggle(place.id));
  item.append(button, detail);
  return {
    item,
    focus: () => button.focus(),
    setExpanded(expanded) {
      detail.hidden = !expanded;
      button.setAttribute('aria-expanded', String(expanded));
    },
  };
}
