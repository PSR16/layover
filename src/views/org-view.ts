/** org view (#org): the night's risk now. Slots, routes and coverage are added when they work. */
import type { AppContext } from '../context.ts';
import { mountNightSection } from './night-section.ts';
/** @returns {() => void} cleanup */
export function renderOrgView(container: HTMLElement, context: AppContext): () => void {
  const section = container.ownerDocument.createElement('section');
  section.setAttribute('aria-label', 'Tonight');
  container.replaceChildren(section);
  return mountNightSection(section, { ...context, idPrefix: 'org' });
}
