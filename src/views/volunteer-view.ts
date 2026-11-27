/** Volunteer view (#volunteer): tonight's conditions now; open slots and boarding passes come later. */
import type { AppContext } from '../context.ts';
import { mountNightSection } from './night-section.ts';

/** @returns {() => void} cleanup */
export function renderVolunteerView(container: HTMLElement, context: AppContext): () => void {
  const page = container.ownerDocument;
  const heading = page.createElement('h2');
  heading.textContent = 'Volunteer';
  const note = page.createElement('p');
  note.textContent =
    'Check the night, then pick a dawn slot. Open slots and your boarding passes are coming.';
  const section = page.createElement('section');
  section.setAttribute('aria-label', 'Night conditions');
  container.replaceChildren(heading, note, section);
  return mountNightSection(section, { ...context, idPrefix: 'volunteer' });
}
