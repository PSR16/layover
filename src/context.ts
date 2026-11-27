/** The one object the views receive: city, saved nights, selection store and weather loaders. */
import type { City, Location, ReplayNight, WeatherResult } from './lib/types.ts';
import type { MergedBuildings } from './lib/source-types.ts';
import type { SelectionStore } from './selection.ts';

export interface WeatherLoaders {
  loadReplayWeather: (record: ReplayNight, location: Location) => Promise<WeatherResult>;
  loadTonightWeather: (location: Location) => Promise<WeatherResult>;
}

export interface AppContext {
  city: City;
  records: ReplayNight[];
  store: SelectionStore;
  loaders: WeatherLoaders;
  /** Loads the building extracts for every study area (spec 2 R31). */
  loadBuildings: () => Promise<MergedBuildings>;
  datasetAttribution?: string;
}
