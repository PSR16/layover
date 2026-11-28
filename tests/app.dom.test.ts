// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest';
import { startApp } from '../src/app.ts';
import { fakeLoaders, settle } from './helpers/app-context.ts';

let stop;

async function start(hash) {
  stop?.();
  document.body.innerHTML = '<main id="app"></main>';
  window.location.hash = hash;
  const loaders = fakeLoaders();
  stop = startApp({
    root: document.querySelector('#app'),
    browserWindow: window,
    deps: { loaders, loadBuildings: async () => ({ buildings: [], loaded: [], failed: [] }) },
  });
  await settle();
  return loaders;
}

const panelPrefix = () => document.querySelector('.field select').id.replace('-select', '');
const currentLink = () => document.querySelector('[aria-current="page"]').dataset.route;

describe('app start (R1, R2)', () => {
  beforeEach(() => {
    window.location.hash = '';
  });

  it('shows the volunteer view and sets the hash when the address has no hash', async () => {
    await start('');
    expect(panelPrefix()).toBe('volunteer');
    expect(window.location.hash).toBe('#volunteer');
    expect(currentLink()).toBe('volunteer');
  });

  it('shows the organization view for #org', async () => {
    await start('#org');
    expect(panelPrefix()).toBe('org');
    expect(currentLink()).toBe('org');
  });

  it('falls back to the volunteer view for an unknown hash', async () => {
    await start('#somewhere-else');
    expect(panelPrefix()).toBe('volunteer');
    expect(window.location.hash).toBe('#volunteer');
  });

  it('switches view when the hash changes', async () => {
    await start('#volunteer');
    window.location.hash = '#org';
    window.dispatchEvent(new window.HashChangeEvent('hashchange'));
    await settle();
    expect(panelPrefix()).toBe('org');
    expect(currentLink()).toBe('org');
  });
});

describe('night panel in both views (R6, R9, R29)', () => {
  it('shows tonight with its labels, a risk word and reasons on the volunteer view', async () => {
    await start('#volunteer');
    const text = document.querySelector('.app-main').textContent;
    expect(text).toContain('Tonight, 2026-11-26');
    expect(text).toContain('Sample data');
    expect(text).toContain('Sample migration level');
    expect(text).toContain('Weather from weather.gov');
    expect(document.querySelector('.risk-word').textContent).toMatch(/^(Low|Elevated|High)$/);
    expect(document.querySelectorAll('.board-reasons li').length).toBeGreaterThan(0);
  });

  it('shows the same panel on the organization view', async () => {
    await start('#org');
    expect(document.querySelector('.board-title').textContent).toContain('Tonight');
    expect(document.querySelector('.risk-word')).not.toBeNull();
  });

  it('keeps the chosen night when switching views', async () => {
    await start('#volunteer');
    const select = document.querySelector('#volunteer-select');
    select.value = 'radar-2018-05-01';
    select.dispatchEvent(new window.Event('change'));
    await settle();
    window.location.hash = '#org';
    window.dispatchEvent(new window.HashChangeEvent('hashchange'));
    await settle();
    expect(document.querySelector('.board-title').textContent).toBe('Night of 2018-05-01');
    expect(document.querySelector('#org-select').value).toBe('radar-2018-05-01');
  });
});
