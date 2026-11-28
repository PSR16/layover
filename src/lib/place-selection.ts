/**
 * Which place is selected (spec 2 R22). The list rows and the map markers both read and write this
 * one value, so they stay in step. Pure logic, no DOM. Kept apart from the night selection so that
 * choosing a place never makes the night panel reload its weather.
 */
export type PlaceSelectionListener = (id: string | null) => void;
export interface PlaceSelection {
  get: () => string | null;
  /** Select a place, or clear the selection with null. */
  select: (id: string | null) => void;
  /** Select the place, or clear it when it is already selected (a second tap on a row). */
  toggle: (id: string) => void;
  subscribe: (listener: PlaceSelectionListener) => () => void;
}
export function createPlaceSelection(): PlaceSelection {
  let current: string | null = null;
  const listeners = new Set<PlaceSelectionListener>();
  const select = (id: string | null) => {
    if (id === current) {
      return;
    }
    current = id;
    for (const listener of [...listeners]) {
      listener(current);
    }
  };
  return {
    get: () => current,
    select,
    toggle: (id) => select(current === id ? null : id),
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
