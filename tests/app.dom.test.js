// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, vi } from 'vitest';

async function startApp(hash) {
  vi.resetModules();
  document.body.innerHTML = '<main id="app"></main>';
  window.location.hash = hash;
  await import('../src/main.js');
}

const heading = () => document.querySelector('.app-main h2').textContent;
const currentLink = () => document.querySelector('[aria-current="page"]').dataset.route;

describe('app start (R1, R2)', () => {
  beforeEach(() => {
    window.location.hash = '';
  });

  it('shows the volunteer view and sets the hash when the address has no hash', async () => {
    await startApp('');
    expect(heading()).toBe('Volunteer');
    expect(window.location.hash).toBe('#volunteer');
    expect(currentLink()).toBe('volunteer');
  });

  it('shows the organization view for #org', async () => {
    await startApp('#org');
    expect(heading()).toBe('Organization');
    expect(currentLink()).toBe('org');
  });

  it('falls back to the volunteer view for an unknown hash', async () => {
    await startApp('#somewhere-else');
    expect(heading()).toBe('Volunteer');
    expect(window.location.hash).toBe('#volunteer');
  });

  it('switches view when the hash changes', async () => {
    await startApp('#volunteer');
    window.location.hash = '#org';
    window.dispatchEvent(new window.HashChangeEvent('hashchange'));
    expect(heading()).toBe('Organization');
    expect(currentLink()).toBe('org');
  });
});
