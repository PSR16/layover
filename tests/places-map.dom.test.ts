// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest';
import { CHICAGO } from '../src/config/city.ts';
import { findReplayNight } from '../src/data/replay-nights.ts';
import { mountPlacesSection } from '../src/views/places-section.ts';
import { settle } from './helpers/app-context.ts';
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
const rowButtons = () => [...container.querySelectorAll('.place-row > button')];
import { createFakeLeaflet } from './helpers/fake-leaflet.ts';

describe('place map (R21, R22, R25)', () => {
  const press = (selector: string) => container.querySelector<HTMLButtonElement>(selector)!.click();
  async function mountWithMap(count = 3) {
    const fake = createFakeLeaflet();
    let loads = 0;
    const section = mountPlacesSection(container, {
      city: CHICAGO,
      hotspots: [],
      loadBuildings: loaded(venues(count)),
      loadLeafletModule: async () => {
        loads++;
        return fake.leaflet as never;
      },
    });
    section.update(busyNight());
    await settle();
    return { ...fake, loads: () => loads, section };
  }
  it('does not load the map until Show map is pressed', async () => {
    const map = await mountWithMap();
    expect(map.loads()).toBe(0);
    expect(map.calls.markers).toHaveLength(0);
    press('.map-toggle');
    await settle();
    expect(map.loads()).toBe(1);
    expect(map.calls.markers).toHaveLength(3);
    expect(container.querySelector('.map-toggle')!.textContent).toBe('Hide map');
  });
  it('opens the row detail when a marker is pressed, and back', async () => {
    const map = await mountWithMap();
    press('.map-toggle');
    await settle();
    map.calls.markers[1].button.click();
    const rows = [...container.querySelectorAll('.place-row')];
    expect(rows.map((row) => row.querySelector('.place-detail')!.hasAttribute('hidden'))).toEqual([
      true,
      false,
      true,
    ]);
    expect(map.calls.markers[1].button.getAttribute('aria-pressed')).toBe('true');
    rowButtons()[2].click();
    expect(map.calls.markers[2].button.getAttribute('aria-pressed')).toBe('true');
    expect(map.calls.markers[1].button.getAttribute('aria-pressed')).toBe('false');
  });
  it('adds markers for rows revealed by Show more', async () => {
    const map = await mountWithMap(12);
    press('.map-toggle');
    await settle();
    expect(map.calls.markers).toHaveLength(10);
    press('.place-more');
    expect(map.calls.markers).toHaveLength(12);
  });
  it('says so and keeps the list when Leaflet fails to load, and can retry', async () => {
    let attempts = 0;
    const fake = createFakeLeaflet();
    const section = mountPlacesSection(container, {
      city: CHICAGO,
      hotspots: [],
      loadBuildings: loaded(venues(2)),
      loadLeafletModule: async () => {
        attempts++;
        if (attempts === 1) {
          throw new Error('offline');
        }
        return fake.leaflet as never;
      },
    });
    section.update(busyNight());
    await settle();
    press('.map-toggle');
    await settle();
    expect(container.textContent).toContain('Could not load the map');
    expect(rowButtons()).toHaveLength(2);
    press('.map-toggle');
    await settle();
    expect(fake.calls.markers).toHaveLength(2);
  });
  it('shows the Overture and OpenStreetMap credits once', async () => {
    await mountWithMap();
    const text = container.textContent!;
    expect(text.match(/Overture Maps/g)).toHaveLength(1);
    expect(text.match(/OpenStreetMap contributors/g)).toHaveLength(1);
  });
});
