/**
 * Turn a saved replay night into the conditions the risk engine reads (R26, R27).
 * Copies the values, so the saved record is never changed by the engine, and leaves out
 * everything the engine must not see (survey counts, notes, links).
 */

export function conditionsFromReplay(record) {
  return {
    night: record.night,
    migration: structuredClone(record.migration),
    weather: structuredClone(record.weather),
  };
}
