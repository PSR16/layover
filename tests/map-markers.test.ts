import { describe, it, expect } from 'vitest';
import fastCheck from 'fast-check';
import { buildMarkerSpecs, markerBounds, type MarkerSpec } from '../src/lib/map-markers.ts';
const entry = (id: string, latitude: number, longitude: number, name?: string) =>
  ({
    candidate: {
      place: { id },
      name,
      coordinate: { latitude, longitude },
      building: null,
      hotspot: null,
      usesSampleValues: false,
    },
    level: 'high',
    reasons: [],
    missingInputs: [],
    assumesLit: false,
  }) as never;
describe('marker specs', () => {
  it('carry the risk word and a spoken label', () => {
    const [spec] = buildMarkerSpecs([entry('a', 41.8, -87.6, 'Soldier Field')]);
    expect(spec).toMatchObject({ id: 'a', text: 'High', label: 'Soldier Field, high risk' });
  });
  it('use Unnamed building when there is no name', () => {
    expect(buildMarkerSpecs([entry('a', 41.8, -87.6)])[0].label).toBe(
      'Unnamed building, high risk',
    );
  });
  it('leave out places without a usable coordinate', () => {
    const specs = buildMarkerSpecs([
      entry('nan', Number.NaN, -87.6),
      entry('far', 95, -87.6),
      entry('ok', 41.8, -87.6),
    ]);
    expect(specs.map((spec) => spec.id)).toEqual(['ok']);
  });
  it('gives no bounds for no markers', () => {
    expect(markerBounds([])).toBeNull();
  });
  it('bounds hold every marker (property)', () => {
    const spec = fastCheck.record({
      id: fastCheck.string(),
      latitude: fastCheck.double({ min: -90, max: 90, noNaN: true }),
      longitude: fastCheck.double({ min: -180, max: 180, noNaN: true }),
      level: fastCheck.constant('high' as const),
      text: fastCheck.constant('High'),
      label: fastCheck.constant('x'),
    });
    fastCheck.assert(
      fastCheck.property(fastCheck.array(spec, { minLength: 1 }), (specs: MarkerSpec[]) => {
        const [[south, west], [north, east]] = markerBounds(specs)!;
        for (const item of specs) {
          expect(item.latitude).toBeGreaterThanOrEqual(south);
          expect(item.latitude).toBeLessThanOrEqual(north);
          expect(item.longitude).toBeGreaterThanOrEqual(west);
          expect(item.longitude).toBeLessThanOrEqual(east);
        }
      }),
    );
  });
});
