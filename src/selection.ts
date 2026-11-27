/**
 * Which night is selected, kept in memory so it survives switching between the two views.
 * `nightId` is 'tonight' or the id of a replay night. `sampleLevel` is a key of SAMPLE_LEVELS.
 */
import { DEFAULT_SAMPLE_LEVEL } from './lib/night-model.ts';

export const TONIGHT_ID = 'tonight';

export interface SelectionState {
  nightId: string;
  sampleLevel: string;
}
export type SelectionListener = (state: SelectionState) => void;
export interface SelectionStore {
  get: () => SelectionState;
  set: (changes: Partial<SelectionState>) => void;
  subscribe: (listener: SelectionListener) => () => void;
}
export function createSelectionStore(): SelectionStore {
  const state: SelectionState = { nightId: TONIGHT_ID, sampleLevel: DEFAULT_SAMPLE_LEVEL };
  const listeners = new Set<SelectionListener>();
  return {
    get: () => ({ ...state }),
    set(changes: Partial<SelectionState>) {
      Object.assign(state, changes);
      for (const listener of [...listeners]) {
        listener({ ...state });
      }
    },
    subscribe(listener: SelectionListener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
