// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest';
import { createLiveSource } from '../src/api/overpass.ts';
import { loadAllAreas } from '../src/api/sources.ts';
import { CHICAGO } from '../src/config/city.ts';
import { findReplayNight } from '../src/data/replay-nights.ts';
import { mountPlacesSection } from '../src/views/places-section.ts';
import { settle } from './helpers/app-context.ts';
import { makeBuilding } from './helpers/buildings.ts';
import { hang, recorder, reply } from './helpers/fake-fetch.ts';
import { answer, memoryStorage, wayElement } from './helpers/overpass.ts';
let container;
beforeEach(() => {
  document.body.innerHTML = '<section id="slot"></section>';
  container = document.querySelector('#slot');
});
const night = findReplayNight('news-2023-10-04');
const scoring = {
  conditions: { night: night.night, migration: night.migration, weather: night.weather },
  overrides: CHICAGO.riskOverrides,
};
const savedBuildings = [makeBuilding('saved-1', { kind: 'stadium', name: 'Saved Arena' })];
const savedSource = {
  id: 'static',
  load: async () => ({ buildings: savedBuildings, savedOn: '2026-11-18', fromCache: false }),
};
const liveAnswer = () =>
  reply(answer([wayElement(77, { building: 'stadium', name: 'Live Stadium' }, [41.7, -87.5])]));
function liveSetup(handler = liveAnswer, extra = {}) {
  const { fetchFn, calls } = recorder(handler);
  const live = createLiveSource({
    fetchFn,
    storage: memoryStorage(),
    session: new Map(),
    now: () => new Date('2026-11-27T15:00:00Z'),
    ...extra,
  });
  return { calls, live };
}
async function mount(live, hotspots = []) {
  const section = mountPlacesSection(container, {
    city: CHICAGO,
    hotspots,
    loadBuildings: () => loadAllAreas([savedSource]),
    loadLiveBuildings: () => loadAllAreas([savedSource, live]),
  });
  section.update(scoring);
  await settle();
  await settle();
  return section;
}
const names = () =>
  [...container.querySelectorAll('.place-row > button')].map((button) => button.textContent);
const line = () => container.querySelector('.live-line');
const retry = () => container.querySelector('.live-retry');
describe('live source with a visible fallback (spec 2 R12)', () => {
  it('adds live buildings to the saved list and credits OpenStreetMap', async () => {
    await mount(liveSetup().live);
    expect(names().join(' ')).toContain('Saved Arena');
    expect(names().join(' ')).toContain('Live Stadium');
    expect(line().textContent).toContain('Includes current OpenStreetMap buildings');
    expect(retry()).toBeNull();
    expect(container.querySelector('[data-credit="openstreetmap"]')).not.toBeNull();
  });
  const reasons = [
    ['timeout', { handler: hang, extra: { timeoutMs: 5 } }, 'did not answer in time'],
    ['rate limit', { handler: () => reply({}, 429) }, 'asking for fewer requests'],
    [
      'network',
      {
        handler: () => {
          throw new TypeError('offline');
        },
      },
      'Could not reach OpenStreetMap',
    ],
    ['empty', { handler: () => reply(answer([])) }, 'had no buildings'],
  ];
  it.each(reasons)('keeps the saved list and explains a %s failure', async (_name, setup, text) => {
    await mount(liveSetup(setup.handler, setup.extra).live);
    await new Promise((resolve) => setTimeout(resolve, 40));
    await settle();
    expect(names().join(' ')).toContain('Saved Arena');
    expect(line().textContent).toContain('Live map data unavailable');
    expect(line().textContent).toContain(text);
    expect(line().textContent).toContain('saved building data from 2026-11-18');
    expect(retry().textContent).toBe('Retry');
  });
  it('shows a checking status first, and the saved list is there before live answers', async () => {
    const releases = [];
    const { live } = liveSetup(() => new Promise((resolve) => releases.push(resolve)));
    await mount(live);
    expect(names().join(' ')).toContain('Saved Arena');
    expect(line().textContent).toContain('Checking OpenStreetMap');
    expect(retry()).toBeNull();
    for (const release of releases) {
      release(liveAnswer());
    }
    for (let turn = 0; turn < 5; turn += 1) {
      await settle();
    }
    expect(names().join(' ')).toContain('Live Stadium');
  });
  it('retry shows the loading line, then merges live data when it works', async () => {
    let attempt = 0;
    const { live, calls } = liveSetup(() => (++attempt <= 3 ? reply({}, 502) : liveAnswer()));
    await mount(live);
    expect(names().join(' ')).not.toContain('Live Stadium');
    retry().click();
    expect(line().textContent).toContain('Checking OpenStreetMap');
    expect(retry()).toBeNull();
    await settle();
    await settle();
    expect(names().join(' ')).toContain('Live Stadium');
    expect(names().join(' ')).toContain('Saved Arena');
    expect(retry()).toBeNull();
    expect(calls.length).toBeGreaterThan(3);
  });
  it('retry that fails again keeps the saved list and the Retry button', async () => {
    await mount(liveSetup(() => reply({}, 502)).live);
    retry().click();
    await settle();
    await settle();
    expect(names().join(' ')).toContain('Saved Arena');
    expect(line().textContent).toContain(
      'Live map data unavailable: OpenStreetMap could not answer',
    );
    expect(retry()).not.toBeNull();
  });
  it('shows a live map name as text, not markup', async () => {
    const hostile = '<img src=x onerror=alert(1)>';
    await mount(
      liveSetup(() =>
        reply(answer([wayElement(5, { building: 'stadium', name: hostile }, [41.7, -87.5])])),
      ).live,
    );
    expect(container.querySelector('img')).toBeNull();
    expect(names().join(' ')).toContain(hostile);
  });
  it.each([
    ['an empty failed result', async () => ({ buildings: [], loaded: [], failed: [] })],
    [
      'a rejected load',
      async () => {
        throw new Error('crashed');
      },
    ],
  ])('keeps the saved list when the live loader gives %s', async (_name, loadLive) => {
    const section = mountPlacesSection(container, {
      city: CHICAGO,
      hotspots: [],
      loadBuildings: () => loadAllAreas([savedSource]),
      loadLiveBuildings: loadLive,
    });
    section.update(scoring);
    await settle();
    await settle();
    expect(names().join(' ')).toContain('Saved Arena');
  });
  it('works with no live loader at all', async () => {
    const section = mountPlacesSection(container, {
      city: CHICAGO,
      hotspots: [],
      loadBuildings: () => loadAllAreas([savedSource]),
    });
    section.update(scoring);
    await settle();
    expect(names().join(' ')).toContain('Saved Arena');
    expect(line().textContent).toBe('');
  });
});
