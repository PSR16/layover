// Hand-written Overpass answers in the shape of `out tags geom`. Not recorded from the live server.
export const wayElement = (id, tags = {}, corner = [41.88, -87.63]) => {
  const [south, west] = corner;
  const size = 0.0002;
  return {
    type: 'way',
    id,
    bounds: { minlat: south, minlon: west, maxlat: south + size, maxlon: west + size },
    geometry: [
      { lat: south, lon: west },
      { lat: south, lon: west + size },
      { lat: south + size, lon: west + size },
      { lat: south + size, lon: west },
      { lat: south, lon: west },
    ],
    tags: { building: 'yes', ...tags },
  };
};

export const answer = (elements, extra = {}) => ({
  version: 0.6,
  generator: 'Overpass API (hand-written test answer)',
  elements,
  ...extra,
});

/** A Storage stand-in that keeps values in a Map. */
export const memoryStorage = (initial = {}) => {
  const values = new Map(Object.entries(initial));
  return {
    values,
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => void values.set(key, String(value)),
  };
};
