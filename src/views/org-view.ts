/** Organization view (#org): the night level now; ranked routes and coverage gaps come later. */
import type { AppContext } from '../context.ts';
import { mountNightSection } from './night-section.ts';

/** @returns {() => void} cleanup */
export function renderOrgView(container: HTMLElement, context: AppContext): () => void {
  const page = container.ownerDocument;
  const heading = page.createElement('h2');
  heading.textContent = 'Organization';
  const note = page.createElement('p');
  note.textContent = 'See how risky the night is. Ranked routes and coverage gaps are coming.';
  const section = page.createElement('section');
  section.setAttribute('aria-label', 'Night conditions');
  container.replaceChildren(heading, note, section);
  return mountNightSection(section, { ...context, idPrefix: 'org' });
}
