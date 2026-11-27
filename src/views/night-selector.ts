/**
 * The two controls above the board: which night to look at, and (for tonight) which sample
 * migration level to use. Plain labelled selects, sized by the 44 px control rule (R4).
 */
import type { ReplayNight } from '../lib/types.ts';
import type { SelectionState } from '../selection.ts';
import { SAMPLE_LEVELS } from '../lib/night-model.ts';

const KIND_WORDS: Record<string, string> = {
  'mortality-event': 'busy night',
  quiet: 'quiet night',
  'busy-few-birds': 'busy migration, quiet dawn',
  'news-event': 'in the news',
};

function addOption(page: Document, select: HTMLSelectElement, value: string, text: string) {
  const option = page.createElement('option');
  option.value = value;
  option.textContent = text;
  select.append(option);
}

function labelledSelect(page: Document, { id, label }: { id: string; label: string }) {
  const wrapper = page.createElement('div');
  wrapper.className = 'field';
  const text = page.createElement('label');
  text.htmlFor = id;
  text.textContent = label;
  const select = page.createElement('select');
  select.id = id;
  wrapper.append(text, select);
  return { wrapper, select };
}

/** The option text for a replay night: the date and a short plain description, no counts. */
export function replayOptionText(record: ReplayNight): string {
  return `${record.night}, ${KIND_WORDS[record.kind] ?? 'replay night'}`;
}

/**
 * @param {Document} page
 * @param {{ records: object[], state: { nightId: string, sampleLevel: string }, tonightId: string,
 *   onChange: (changes: object) => void, idPrefix?: string }} options
 */
export interface SelectorOptions {
  records: ReplayNight[];
  state: SelectionState;
  tonightId: string;
  onChange: (changes: Partial<SelectionState>) => void;
  idPrefix?: string;
}
export function createNightSelector(
  page: Document,
  { records, state, tonightId, onChange, idPrefix = 'night' }: SelectorOptions,
): HTMLElement {
  const form = page.createElement('div');
  form.className = 'selector';
  const night = labelledSelect(page, { id: `${idPrefix}-select`, label: 'Night' });
  addOption(page, night.select, tonightId, 'Tonight (live weather)');
  for (const record of records) {
    addOption(page, night.select, record.id, replayOptionText(record));
  }
  night.select.value = state.nightId;
  night.select.addEventListener('change', () => onChange({ nightId: night.select.value }));
  form.append(night.wrapper);

  if (state.nightId === tonightId) {
    const level = labelledSelect(page, {
      id: `${idPrefix}-level`,
      label: 'Sample migration level',
    });
    for (const [key, entry] of Object.entries(SAMPLE_LEVELS)) {
      addOption(page, level.select, key, entry.label);
    }
    level.select.value = state.sampleLevel;
    level.select.addEventListener('change', () => onChange({ sampleLevel: level.select.value }));
    form.append(level.wrapper);
  }
  return form;
}
