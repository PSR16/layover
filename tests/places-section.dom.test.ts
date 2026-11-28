// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest';
import { CHICAGO } from '../src/config/city.ts';
import { HOTSPOTS } from '../src/data/hotspots.ts';
import { findReplayNight } from '../src/data/replay-nights.ts';
import { mountPlacesSection } from '../src/views/places-section.ts';
import { startApp } from '../src/app.ts';
import { fakeLoaders, settle } from './helpers/app-context.ts';
import { makeBuilding } from './helpers/buildings.ts';
let container;
beforeEach(() => {
  document.body.innerHTML = '<section id="slot"></section>';
  container = document.querySelector('#slot');
});
const night = findReplayNight('news-2023-10-04');
const busyNight = () => ({
  conditions: { night: night.night, migration: night.migration, weather: night.weather },
  overrides: CHICAGO.riskOverrides,
});
const quietNight = () => {
  const quiet = findReplayNight('radar-2001-10-12');
  return {
    conditions: { night: quiet.night, migration: quiet.migration, weather: quiet.weather },
    overrides: CHICAGO.riskOverrides,
  };
};
/** Stadium-kind buildings score elevated on the busy night. Ids sort the order. */
function venues(count, nameOf = (index) => `Venue ${index}`) {
  return Array.from({ length: count }, (_unused, index) =>
    makeBuilding(`venue-${String(index).padStart(3, '0')}`, {
      kind: 'stadium',
      name: nameOf(index),
      latitude: 41.7 + index * 0.001,
    }),
  );
}
const loaded = (buildings) => async () => ({ buildings, loaded: [], failed: [] });
async function mount(buildings, scoring = busyNight(), hotspots = []) {
  const section = mountPlacesSection(container, {
    city: CHICAGO,
    hotspots,
    loadBuildings: loaded(buildings),
  });
  section.update(scoring);
  await settle();
  return section;
}
const rowButtons = () => [...container.querySelectorAll('.place-row > button')];
describe('place list (R24)', () => {
  it('shows a loading status before buildings arrive', () => {
    mountPlacesSection(container, { city: CHICAGO, loadBuildings: () => new Promise(() => {}) });
    expect(container.querySelector('[role="status"]').textContent).toBe('Loading buildings...');
    expect(rowButtons()).toHaveLength(0);
  });
  it('shows 10 rows first, then appends 10 more and keeps focus on the first new row', async () => {
    await mount(venues(25));
    const rows = rowButtons();
    expect(rows.length).toBeGreaterThanOrEqual(10);
    const total = container.querySelectorAll('.place-row').length;
    expect(total).toBe(10);
    const first = rowButtons()[0];
    container.querySelector('.place-more').click();
    expect(container.querySelectorAll('.place-row')).toHaveLength(20);
    expect(rowButtons()[0]).toBe(first);
    expect(document.activeElement).toBe(rowButtons()[10]);
    container.querySelector('.place-more').click();
    expect(container.querySelectorAll('.place-row').length).toBeLessThanOrEqual(30);
  });
  it('hides Show more when everything is already shown', async () => {
    await mount(venues(4));
    expect(container.querySelector('.place-more').hidden).toBe(true);
  });
  it('says why the list is empty and what to do', async () => {
    await mount(venues(5), quietNight());
    expect(container.querySelector('[role="status"]').textContent).toBe(
      'No places score above low for this night. Pick another night.',
    );
  });
  it('lists only the known sites and says so when buildings fail to load', async () => {
    const section = mountPlacesSection(container, {
      city: CHICAGO,
      loadBuildings: async () => {
        throw new Error('offline');
      },
    });
    section.update(busyNight());
    await settle();
    expect(container.textContent).toContain('Buildings did not load');
    expect(container.textContent).toContain('Reload the page');
    expect(container.querySelectorAll('.place-row').length).toBeGreaterThan(0);
  });
  it('re-ranks without reloading when the night changes', async () => {
    let calls = 0;
    const section = mountPlacesSection(container, {
      city: CHICAGO,
      loadBuildings: async () => {
        calls += 1;
        return { buildings: venues(5), loaded: [], failed: [] };
      },
    });
    section.update(busyNight());
    await settle();
    const busy = container.querySelectorAll('.place-row').length;
    section.update(quietNight());
    expect(container.querySelectorAll('.place-row').length).toBeLessThan(busy);
    expect(calls).toBe(1);
  });
});
describe('row and detail (R19, R22)', () => {
  it('rows are buttons that open and close their detail', async () => {
    await mount(venues(3));
    const [button] = rowButtons();
    const detail = button.parentElement.querySelector('.place-detail');
    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(detail.hidden).toBe(true);
    button.click();
    expect(button.getAttribute('aria-expanded')).toBe('true');
    expect(detail.hidden).toBe(false);
    expect(detail.textContent).toContain('Lighting not known');
    button.click();
    expect(detail.hidden).toBe(true);
  });
  it('opens one detail at a time', async () => {
    await mount(venues(3));
    const [first, second] = rowButtons();
    first.click();
    second.click();
    expect(first.getAttribute('aria-expanded')).toBe('false');
    expect(second.getAttribute('aria-expanded')).toBe('true');
  });
  it('shows only a risk word, with no digits of birds or points, and a name or "Unnamed building"', async () => {
    await mount([...venues(2), makeBuilding('zzz', { kind: 'stadium' })]);
    const text = container.querySelector('.place-list').textContent;
    expect(text).toMatch(/Elevated|High/);
    expect(text).toContain('Unnamed building');
    expect(text).not.toMatch(/\bscore\b|\d birds|\d at risk|\bpoints\b/i);
    expect(text).not.toMatch(/touch|catch|pick up|handle/i);
  });
  it('labels hand-set sites as Sample data and adds the credits for building data', async () => {
    await mount(venues(1), busyNight(), HOTSPOTS);
    expect(container.querySelector('.place-list').textContent).toContain('Sample data');
    expect(container.querySelector('[data-credit="overture"]')).not.toBeNull();
    expect(container.querySelector('[data-credit="openstreetmap"]')).not.toBeNull();
  });
});
describe('hostile text (R27)', () => {
  it('renders markup in a building name as text and creates no elements', async () => {
    const hostile = '<img src=x onerror="window.pwned=1"><script>window.pwned=1</script>';
    await mount(venues(3, () => hostile));
    expect(container.querySelector('.place-list img')).toBeNull();
    expect(container.querySelector('script')).toBeNull();
    expect(container.querySelector('.place-name').textContent).toBe(hostile);
    expect(window.pwned).toBeUndefined();
  });
});
describe('org view', () => {
  it('shows the place list under the night panel', async () => {
    document.body.innerHTML = '<main id="app"></main>';
    const root = document.querySelector('#app');
    const stop = startApp({
      root,
      browserWindow: window,
      deps: { loaders: fakeLoaders(), loadBuildings: loaded(venues(3)) },
    });
    window.location.hash = '#org';
    await settle();
    await settle();
    const sections = [...root.querySelectorAll('section')];
    expect(sections.map((section) => section.getAttribute('aria-label'))).toEqual([
      'Tonight',
      'Places',
    ]);
    expect(root.querySelector('.map-toggle')).not.toBeNull();
    expect(root.querySelector('.place-more')).not.toBeNull();
    stop();
  });
});
