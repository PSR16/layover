import { describe, it, expect } from 'vitest';
import fastCheck from 'fast-check';
import { createPlaceSelection } from '../src/lib/place-selection.ts';
describe('place selection', () => {
  it('starts empty and tells listeners about changes only', () => {
    const selection = createPlaceSelection();
    const seen: (string | null)[] = [];
    selection.subscribe((id) => seen.push(id));
    selection.select('a');
    selection.select('a');
    selection.select(null);
    expect(seen).toEqual(['a', null]);
  });
  it('toggle clears a place that is already selected', () => {
    const selection = createPlaceSelection();
    selection.toggle('a');
    expect(selection.get()).toBe('a');
    selection.toggle('a');
    expect(selection.get()).toBeNull();
  });
  it('stops telling a listener after it unsubscribes', () => {
    const selection = createPlaceSelection();
    let count = 0;
    const stop = selection.subscribe(() => count++);
    stop();
    selection.select('a');
    expect(count).toBe(0);
  });
  it('holds the last id selected, whatever the sequence (property)', () => {
    fastCheck.assert(
      fastCheck.property(
        fastCheck.array(fastCheck.option(fastCheck.string(), { nil: null }), { minLength: 1 }),
        (ids) => {
          const selection = createPlaceSelection();
          for (const id of ids) {
            selection.select(id);
          }
          expect(selection.get()).toBe(ids.at(-1));
        },
      ),
    );
  });
});
