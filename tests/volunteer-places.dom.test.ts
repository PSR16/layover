// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest';
import { startApp } from '../src/app.ts';
import { HOTSPOTS } from '../src/data/hotspots.ts';
import { findReplayNight } from '../src/data/replay-nights.ts';
import { fakeLoaders, settle } from './helpers/app-context.ts';
import { makeBuilding } from './helpers/buildings.ts';
let root;
beforeEach(() => {
  document.body.innerHTML = '<main id="app"></main>';
  root = document.querySelector('#app');
  window.location.hash = '';
});
function venues(count, nameOf = (index) => `Venue ${index}`) {
  return Array.from({ length: count }, (_unused, index) =>
    makeBuilding(`venue-${String(index).padStart(3, '0')}`, {
      kind: 'stadium',
      name: nameOf(index),
      latitude: 41.7 + index * 0.001,
    }),
  );
}
async function open(hash, buildings) {
  const stop = startApp({
    root,
    browserWindow: window,
    deps: {
      loaders: fakeLoaders(),
      loadBuildings: async () => ({ buildings, loaded: [], failed: [] }),
    },
  });
  window.location.hash = hash;
  await settle();
  await settle();
  // pick a saved busy night so the list has places
  const select = root.querySelector('select');
  if (select) {
    select.value = findReplayNight('news-2023-10-04').id;
    select.dispatchEvent(new window.Event('change', { bubbles: true }));
    await settle();
    await settle();
  }
  return stop;
}
describe('volunteer view list (R29)', () => {
  it('shows the top places read-only, with no map button and no Show more', async () => {
    const stop = await open('#volunteer', venues(12));
    expect(root.querySelectorAll('.place-row')).toHaveLength(5);
    expect(root.querySelector('.map-toggle')).toBeNull();
    expect(root.querySelector('.map-canvas')).toBeNull();
    expect(root.querySelector('.place-more')).toBeNull();
    stop();
  });
  it('uses the same labels as the org list', async () => {
    const buildings = [makeBuilding('venue-000', { kind: 'stadium' }), ...venues(2).slice(1)];
    const stop = await open('#volunteer', buildings);
    const text = root.querySelector('.place-list').textContent;
    expect(text).toMatch(/Elevated|High/);
    expect(text).toContain('Unnamed building');
    expect(text).toContain('Sample data');
    const first = root.querySelector('.place-row > button');
    first.click();
    expect(root.querySelector('.place-detail:not([hidden])').textContent).toMatch(
      /Lighting not known|assum/i,
    );
    stop();
  });
  it('has no slot or management controls and never mentions handling birds', async () => {
    const stop = await open('#volunteer', venues(3));
    const list = root.querySelector('.place-list');
    list.querySelector('button').click();
    expect(list.textContent).not.toMatch(/touch|catch|pick up|handle|claim|edit/i);
    expect(HOTSPOTS.length).toBeGreaterThan(0);
    stop();
  });
  it('renders hostile building names as text', async () => {
    const hostile = '<img src=x onerror="window.pwned=1"><script>window.pwned=1</script>';
    const stop = await open(
      '#volunteer',
      venues(3, () => hostile),
    );
    expect(root.querySelector('.place-list img')).toBeNull();
    expect(root.querySelector('.place-list script')).toBeNull();
    const names = [...root.querySelectorAll('.place-name')].map((node) => node.textContent);
    expect(names).toContain(hostile);
    stop();
  });
  it('keeps the org view with its map button and Show more', async () => {
    const stop = await open('#org', venues(12));
    expect(root.querySelector('.map-toggle')).not.toBeNull();
    expect(root.querySelectorAll('.place-row')).toHaveLength(10);
    stop();
  });
});
