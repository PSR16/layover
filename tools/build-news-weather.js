#!/usr/bin/env node
/**
 * Save the weather for the two news-based replay nights (R26, R28).
 *
 *   node tools/build-news-weather.js --out src/data/news-weather.json
 *
 * Needs network access. It asks Open-Meteo's historical-forecast endpoint (forecast-model data,
 * not station observations) for hourly wind, low cloud and visibility around the night, averages
 * the hours into the three night parts and writes the result. The app reads this saved snapshot
 * when the live request fails ("Saved weather") and for these nights always, so the demo works
 * offline. Run it again only to refresh the snapshot.
 */
import { writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { normalizeOpenMeteo } from '../src/lib/weather-normalize.js';

const LOCATION = { name: 'Chicago, Illinois', latitude: 41.88, longitude: -87.63 };
const NIGHTS = ['2026-10-16', '2023-10-04'];
const ENDPOINT = 'https://historical-forecast-api.open-meteo.com/v1/forecast';
const MILLISECONDS_PER_DAY = 86_400_000;
const DECIMALS = 100;

function nextDay(isoDate) {
  return new Date(Date.parse(`${isoDate}T00:00:00Z`) + MILLISECONDS_PER_DAY)
    .toISOString()
    .slice(0, 10);
}

function requestUrl(night) {
  const query = new URLSearchParams({
    latitude: String(LOCATION.latitude),
    longitude: String(LOCATION.longitude),
    start_date: night,
    end_date: nextDay(night),
    hourly: 'wind_speed_10m,wind_direction_10m,cloud_cover_low,visibility',
    wind_speed_unit: 'ms',
    timezone: 'GMT',
  });
  return `${ENDPOINT}?${query}`;
}

function rounded(part) {
  if (!part) {
    return null;
  }
  return Object.fromEntries(
    Object.entries(part).map(([key, value]) => [key, Math.round(value * DECIMALS) / DECIMALS]),
  );
}

async function snapshotFor(night) {
  const response = await fetch(requestUrl(night));
  if (!response.ok) {
    throw new Error(`Open-Meteo returned ${response.status} for ${night}`);
  }
  const { weather, notes } = normalizeOpenMeteo(await response.json(), night, LOCATION);
  const parts = Object.fromEntries(
    Object.entries(weather).map(([part, values]) => [part, rounded(values)]),
  );
  return { weather: parts, notes, requestUrl: requestUrl(night) };
}

async function main() {
  const { values } = parseArgs({
    options: {
      out: { type: 'string', default: 'src/data/news-weather.json' },
      'saved-on': { type: 'string', default: new Date().toISOString().slice(0, 10) },
    },
  });
  const nights = {};
  for (const night of NIGHTS) {
    nights[night] = await snapshotFor(night);
  }
  const result = {
    source: 'Open-Meteo historical-forecast API (forecast-model data, not station observations)',
    location: LOCATION,
    savedOn: values['saved-on'],
    nights,
  };
  writeFileSync(values.out, `${JSON.stringify(result, null, 2)}\n`);
  console.log(`Saved weather for ${NIGHTS.join(', ')} to ${values.out}`);
}

await main();
