import { describe, it, expect } from 'vitest';
import { describeLiveResult } from '../src/lib/live-status.ts';
const staticLoad = { id: 'static', savedOn: '2026-11-18', fromCache: false };
const liveLoad = { id: 'openstreetmap', savedOn: '2026-11-27', fromCache: false };
const result = (loaded, failed) => ({ buildings: [], loaded, failed });
describe('describeLiveResult (spec 2 R12)', () => {
  it('names the reason and the saved date when live data failed', () => {
    const line = describeLiveResult(
      result(
        [staticLoad],
        [{ id: 'openstreetmap', reason: 'OpenStreetMap did not answer in time' }],
      ),
    );
    expect(line.failed).toBe(true);
    expect(line.text).toBe(
      'Live map data unavailable: OpenStreetMap did not answer in time. Showing the saved building data from 2026-11-18.',
    );
  });
  it('says so when live data loaded for some areas only', () => {
    const line = describeLiveResult(
      result(
        [staticLoad, liveLoad],
        [{ id: 'openstreetmap', reason: 'Could not reach OpenStreetMap' }],
      ),
    );
    expect(line.failed).toBe(true);
    expect(line.text).toContain('some areas only');
  });
  it('reports live data without a retry when it loaded', () => {
    const line = describeLiveResult(result([staticLoad, liveLoad], []));
    expect(line).toEqual({
      failed: false,
      text: 'Includes current OpenStreetMap buildings (2026-11-27).',
    });
  });
  it('ignores a failure of some other source', () => {
    const line = describeLiveResult(result([staticLoad], [{ id: 'other', reason: 'x' }]));
    expect(line).toEqual({ failed: false, text: '' });
  });
});
