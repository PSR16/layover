import { describe, it, expect } from 'vitest';
import { startRouter } from '../src/router.ts';

/** A stand-in for the browser window: a hash, history.replaceState and hashchange listeners. */
function fakeWindow(initialHash) {
  const listeners = new Set();
  const replaced = [];
  const browserWindow = {
    location: { hash: initialHash },
    history: {
      replaceState(state, title, url) {
        replaced.push(url);
        browserWindow.location.hash = url;
      },
    },
    addEventListener: (type, listener) => type === 'hashchange' && listeners.add(listener),
    removeEventListener: (type, listener) => type === 'hashchange' && listeners.delete(listener),
  };
  const navigate = (hash) => {
    browserWindow.location.hash = hash;
    for (const listener of [...listeners]) {
      listener();
    }
  };
  return { browserWindow, replaced, navigate, listenerCount: () => listeners.size };
}

describe('startRouter (R1, R2)', () => {
  it('shows the view for the hash on load, without changing the address', () => {
    const { browserWindow, replaced } = fakeWindow('#org');
    const seen = [];
    startRouter({ browserWindow, onRoute: (route) => seen.push(route.name) });
    expect(seen).toEqual(['org']);
    expect(replaced).toEqual([]);
  });

  it('sets the hash to #volunteer and shows that view when the hash is empty', () => {
    const { browserWindow, replaced } = fakeWindow('');
    const seen = [];
    startRouter({ browserWindow, onRoute: (route) => seen.push(route.name) });
    expect(seen).toEqual(['volunteer']);
    expect(replaced).toEqual(['#volunteer']);
    expect(browserWindow.location.hash).toBe('#volunteer');
  });

  it('does the same for an unknown hash', () => {
    const { browserWindow, replaced } = fakeWindow('#nonsense');
    const seen = [];
    startRouter({ browserWindow, onRoute: (route) => seen.push(route.name) });
    expect(seen).toEqual(['volunteer']);
    expect(replaced).toEqual(['#volunteer']);
  });

  it('follows later hash changes, including a fallback', () => {
    const { browserWindow, navigate, replaced } = fakeWindow('#volunteer');
    const seen = [];
    startRouter({ browserWindow, onRoute: (route) => seen.push(route.name) });
    navigate('#org');
    navigate('#bogus');
    navigate('#org');
    expect(seen).toEqual(['volunteer', 'org', 'volunteer', 'org']);
    expect(replaced).toEqual(['#volunteer']);
  });

  it('stops listening when told to', () => {
    const { browserWindow, navigate, listenerCount } = fakeWindow('#volunteer');
    const seen = [];
    const stop = startRouter({ browserWindow, onRoute: (route) => seen.push(route.name) });
    expect(listenerCount()).toBe(1);
    stop();
    expect(listenerCount()).toBe(0);
    navigate('#org');
    expect(seen).toEqual(['volunteer']);
  });
});
