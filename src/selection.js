/**
 * Which night is selected, kept in memory so it survives switching between the two views.
 * `nightId` is 'tonight' or the id of a replay night. `sampleLevel` is a key of SAMPLE_LEVELS.
 */
import { DEFAULT_SAMPLE_LEVEL } from './lib/night-model.js';

export const TONIGHT_ID = 'tonight';

export function createSelectionStore() {
  const state = { nightId: TONIGHT_ID, sampleLevel: DEFAULT_SAMPLE_LEVEL };
  const listeners = new Set();
  return {
    get: () => ({ ...state }),
    set(changes) {
      Object.assign(state, changes);
      for (const listener of [...listeners]) {
        listener({ ...state });
      }
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
