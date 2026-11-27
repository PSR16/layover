/**
 * The page frame: a header with the app name and the two view links, and a main area for the
 * current view. Built with DOM calls and textContent, never innerHTML, so no data can inject markup.
 */
import { ROUTES, type RouteName } from '../lib/route.ts';

const LABELS: Record<RouteName, string> = { volunteer: 'Volunteer', org: 'Organization' };

function createLink(page: Document, name: RouteName) {
  const link = page.createElement('a');
  link.className = 'control nav-link';
  link.href = `#${name}`;
  link.textContent = LABELS[name];
  link.dataset.route = name;
  return link;
}

export interface Shell {
  main: HTMLElement;
  showRoute: (name: string) => void;
}
/**
 * Build the frame inside `root`.
 * @returns {{ main: HTMLElement, showRoute: (name: string) => void }}
 */
export function createShell(root: HTMLElement): Shell {
  const page = root.ownerDocument;
  const header = page.createElement('header');
  header.className = 'app-header';
  const title = page.createElement('h1');
  title.className = 'app-title';
  title.textContent = 'Layover';
  const nav = page.createElement('nav');
  nav.setAttribute('aria-label', 'Views');
  const links = ROUTES.map((name) => createLink(page, name));
  nav.append(...links);
  header.append(title, nav);
  const main = page.createElement('div');
  main.className = 'app-main';
  root.replaceChildren(header, main);

  function showRoute(name: string) {
    for (const link of links) {
      if (link.dataset.route === name) {
        link.setAttribute('aria-current', 'page');
      } else {
        link.removeAttribute('aria-current');
      }
    }
  }
  return { main, showRoute };
}
