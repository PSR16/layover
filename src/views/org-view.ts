/** org view (#org): the night's risk, then the ranked places for that night. Slots, routes and coverage are added when they work. */
import type { AppContext } from '../context.ts';
import { mountNightSection } from './night-section.ts';
import { mountPlacesSection } from './places-section.ts';
function makeSection(page: Document, label: string): HTMLElement {
  const section = page.createElement('section');
  section.setAttribute('aria-label', label);
  return section;
}
/** @returns {() => void} cleanup */
export function renderOrgView(container: HTMLElement, context: AppContext): () => void {
  const page = container.ownerDocument;
  const night = makeSection(page, 'Tonight');
  const places = makeSection(page, 'Places');
  container.replaceChildren(night, places);
  const list = mountPlacesSection(places, context);
  const stopNight = mountNightSection(night, {
    ...context,
    idPrefix: 'org',
    onScoring: list.update,
  });
  return () => {
    stopNight();
    list.stop();
  };
}
