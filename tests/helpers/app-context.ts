// Shared helpers for tests that start views or the app with fake weather. Not a test file.
import { CHICAGO } from '../../src/config/city.ts';
import { RADAR_ATTRIBUTION, REPLAY_NIGHTS } from '../../src/data/replay-nights.ts';
import { createSelectionStore } from '../../src/selection.ts';

export const ROUGH = {
  windFromDegrees: 200,
  windSpeedMps: 9,
  lowCloudPercent: 90,
  visibilityKm: 3,
};

/** Fake weather loaders that answer at once and record how often they were called. */
export function fakeLoaders() {
  const calls = { replay: [], tonight: 0 };
  return {
    calls,
    loadReplayWeather: async (record) => {
      calls.replay.push(record.id);
      return { weather: record.weather, source: 'saved', label: 'Saved weather', notes: [] };
    },
    loadTonightWeather: async () => {
      calls.tonight += 1;
      return {
        night: '2026-11-26',
        weather: { early: ROUGH, middle: ROUGH, late: ROUGH },
        source: 'live',
        label: 'Weather from weather.gov',
        notes: [],
      };
    },
  };
}

export function fakeContext(loaders = fakeLoaders()) {
  return {
    city: CHICAGO,
    records: REPLAY_NIGHTS,
    store: createSelectionStore(),
    loaders,
    loadBuildings: async () => ({ buildings: [], loaded: [], failed: [] }),
    datasetAttribution: RADAR_ATTRIBUTION,
  };
}

/** Let pending promises and their follow-ups finish. */
export const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
