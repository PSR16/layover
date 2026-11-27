// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest';
import { createShell } from '../src/views/app-shell.js';
import { renderOrgView } from '../src/views/org-view.js';
import { renderVolunteerView } from '../src/views/volunteer-view.js';
import { fakeContext, settle } from './helpers/app-context.js';

let root;

beforeEach(() => {
  document.body.innerHTML = '<main id="app"></main>';
  root = document.querySelector('#app');
});

describe('createShell', () => {
  it('builds a header with the app name and a link to each view, and an empty main area', () => {
    const shell = createShell(root);
    expect(root.querySelector('h1').textContent).toBe('Layover');
    const links = [...root.querySelectorAll('nav a')];
    expect(links.map((link) => link.getAttribute('href'))).toEqual(['#volunteer', '#org']);
    expect(links.map((link) => link.textContent)).toEqual(['Volunteer', 'Organization']);
    expect(shell.main.children).toHaveLength(0);
  });

  it('gives each link the control class used for the 44 px minimum size (R4)', () => {
    createShell(root);
    for (const link of root.querySelectorAll('nav a')) {
      expect(link.classList.contains('control')).toBe(true);
    }
  });

  it('labels the navigation for screen readers', () => {
    createShell(root);
    expect(root.querySelector('nav').getAttribute('aria-label')).toBe('Views');
  });

  it('marks only the current view link as the current page', () => {
    const shell = createShell(root);
    shell.showRoute('org');
    const current = [...root.querySelectorAll('[aria-current="page"]')];
    expect(current.map((link) => link.dataset.route)).toEqual(['org']);
    shell.showRoute('volunteer');
    expect(
      [...root.querySelectorAll('[aria-current="page"]')].map((link) => link.dataset.route),
    ).toEqual(['volunteer']);
  });

  it('can be built twice in the same root without leaving old content behind', () => {
    createShell(root);
    createShell(root);
    expect(root.querySelectorAll('header')).toHaveLength(1);
  });
});

describe('views', () => {
  it('render their heading into the container, replacing what was there', async () => {
    const container = document.createElement('div');
    container.textContent = 'old';
    const stopVolunteer = renderVolunteerView(container, fakeContext());
    expect(container.querySelector('h2').textContent).toBe('Volunteer');
    expect(container.textContent).not.toContain('old');
    stopVolunteer();
    const stopOrg = renderOrgView(container, fakeContext());
    expect(container.querySelector('h2').textContent).toBe('Organization');
    expect(container.querySelectorAll('h2')).toHaveLength(1);
    stopOrg();
    await settle();
  });
});
