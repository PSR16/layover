/**
 * Replay nights for the demo (R26, R28): 16 radar nights from the Chicago collision dataset and
 * two news-based nights. Every record carries a `source` (R7), a visible `label` (R6), a note on
 * where its migration level came from, and a saved weather snapshot used when a live weather
 * request fails ("Saved weather", R28).
 *
 * Radar nights: migration is radar-derived and weather is Midway Airport reports. Source
 * `replay`. News nights: migration is hand-set from reports, weather is forecast-model data.
 * Source `sample`, shown as "Sample migration level".
 */
import radarData from './radar-nights.json';
import newsWeather from './news-weather.json';

const BIRDCAST_COOK_COUNTY = 'https://dashboard.birdcast.org/region/US-IL-031';
const MIDWAY_SOURCE = 'Chicago Midway Airport hourly reports (NOAA ISD 725340-14819)';

/** Credit text for the Chicago dataset (CC BY 4.0). Show it wherever these nights are used (R36). */
export const RADAR_ATTRIBUTION = radarData.meta.attribution;

const RADAR_NIGHTS = radarData.nights.map((night) => ({
  ...night,
  weatherSource: MIDWAY_SOURCE,
  weatherSavedOn: radarData.meta.builtOn,
}));

function snapshotOf(night) {
  return {
    weather: newsWeather.nights[night].weather,
    weatherSource: newsWeather.source,
    weatherSavedOn: newsWeather.savedOn,
  };
}

const NEWS_NIGHTS = [
  {
    id: 'news-2026-10-16',
    night: '2026-10-16',
    season: 'fall',
    kind: 'news-event',
    source: 'sample',
    label: 'Replay night, sample migration level',
    migration: { level: 0.95, source: 'sample' },
    ...snapshotOf('2026-10-16'),
    note:
      'The night before the October 17, 2026 collision event in downtown Chicago and Evanston. ' +
      'The migration level is hand-set from a news report of more than 5 million birds over Cook County. ' +
      'Wind was from the north-northwest, favorable for migrants.',
    links: {
      migrationDashboard: `${BIRDCAST_COOK_COUNTY}?night=2026-10-16`,
      report:
        'https://news.wttw.com/2026/10/19/migration-mass-casualty-least-1000-birds-injured-or-killed-weekend-chicago-and',
    },
  },
  {
    id: 'news-2023-10-04',
    night: '2023-10-04',
    season: 'fall',
    kind: 'news-event',
    source: 'sample',
    label: 'Replay night, sample migration level',
    migration: { level: 0.95, source: 'sample' },
    ...snapshotOf('2023-10-04'),
    note:
      'The night before the October 5, 2023 event at McCormick Place Lakeside, reported by the ' +
      'Chicago bird monitors. The date and the migration level are hand-set and still to be ' +
      'confirmed against the regional migration archive. Wind was from the south-southwest with cloud thickening toward dawn.',
    links: { report: 'https://www.birdmonitors.net/LightsOut.php' },
  },
];

/** All replay nights in date order. */
export const REPLAY_NIGHTS = [...RADAR_NIGHTS, ...NEWS_NIGHTS].sort((first, second) =>
  first.night.localeCompare(second.night),
);

export function findReplayNight(id) {
  return REPLAY_NIGHTS.find((night) => night.id === id);
}
