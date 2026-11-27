import { readFileSync } from 'node:fs';
export const AREAS = ['loop', 'lakefront', 'evanston'];
export const realBuildings = () =>
  AREAS.flatMap(
    (area) => JSON.parse(readFileSync(`src/data/buildings-${area}.json`, 'utf8')).buildings,
  );
export const square = (latitude, longitude) => {
  const size = 0.0002;
  const ring = [
    [longitude, latitude],
    [longitude + size, latitude],
    [longitude + size, latitude + size],
    [longitude, latitude + size],
    [longitude, latitude],
  ];
  return ring;
};
export const makeBuilding = (id, overrides = {}) => {
  const { latitude = 41.88, longitude = -87.63, ...rest } = overrides;
  return {
    id,
    footprint: square(latitude, longitude),
    centroid: { latitude: latitude + 0.0001, longitude: longitude + 0.0001 },
    source: 'map',
    sources: ['static'],
    ...rest,
  };
};
