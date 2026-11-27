import { describe, it, expect } from 'vitest';
import fastCheck from 'fast-check';
import { distanceMeters, distanceToLineMeters } from '../src/lib/geo.js';

const point = (latitude, longitude) => ({ latitude, longitude });
const METERS_PER_DEGREE_LATITUDE = 111_195;
const nearestVertexDistance = (origin, vertices) =>
  Math.min(...vertices.map((vertex) => distanceMeters(origin, vertex)));

describe('distanceMeters', () => {
  it('is 0 for the same point and about 111 km for one degree of latitude', () => {
    expect(distanceMeters(point(41.88, -87.63), point(41.88, -87.63))).toBe(0);
    expect(distanceMeters(point(41, -87), point(42, -87))).toBeCloseTo(
      METERS_PER_DEGREE_LATITUDE,
      -2,
    );
  });

  it('shrinks east-west distance with latitude', () => {
    const equator = distanceMeters(point(0, 0), point(0, 1));
    const chicago = distanceMeters(point(41.88, 0), point(41.88, 1));
    expect(chicago / equator).toBeCloseTo(Math.cos((41.88 * Math.PI) / 180), 3);
  });

  it('is symmetric and never negative (property)', () => {
    const coordinate = fastCheck.record({
      latitude: fastCheck.double({ min: -80, max: 80, noNaN: true }),
      longitude: fastCheck.double({ min: -179, max: 179, noNaN: true }),
    });
    fastCheck.assert(
      fastCheck.property(coordinate, coordinate, (first, second) => {
        expect(distanceMeters(first, second)).toBeCloseTo(distanceMeters(second, first), 6);
        expect(distanceMeters(first, second)).toBeGreaterThanOrEqual(0);
      }),
    );
  });
});

describe('distanceToLineMeters', () => {
  // A north-south line along longitude -87.6, from latitude 41.8 to 41.9.
  const line = [point(41.8, -87.6), point(41.9, -87.6)];
  const metersPerDegreeLongitude = METERS_PER_DEGREE_LATITUDE * Math.cos((41.85 * Math.PI) / 180);

  it('measures straight across to the line', () => {
    const east = point(41.85, -87.6 + 1000 / metersPerDegreeLongitude);
    expect(distanceToLineMeters(east, line)).toBeCloseTo(1000, -1);
  });

  it('measures to the nearest end when the point is past the line', () => {
    const past = point(41.9 + 500 / METERS_PER_DEGREE_LATITUDE, -87.6);
    expect(distanceToLineMeters(past, line)).toBeCloseTo(500, -1);
  });

  it('is 0 on the line, and handles a single point and an empty line', () => {
    expect(distanceToLineMeters(point(41.85, -87.6), line)).toBeCloseTo(0, 3);
    expect(
      distanceToLineMeters(point(41.9 + 100 / METERS_PER_DEGREE_LATITUDE, -87.6), [
        point(41.9, -87.6),
      ]),
    ).toBeCloseTo(100, -1);
    expect(distanceToLineMeters(point(41.85, -87.6), [])).toBe(Number.POSITIVE_INFINITY);
  });

  it('uses the nearest segment of a bent line', () => {
    const bent = [point(41.8, -87.6), point(41.85, -87.6), point(41.85, -87.5)];
    const nearSecond = point(41.8505, -87.55);
    expect(distanceToLineMeters(nearSecond, bent)).toBeCloseTo(55.6, -1);
  });

  it('is never more than the distance to any one vertex (property)', () => {
    const coordinate = fastCheck.record({
      latitude: fastCheck.double({ min: 41.7, max: 42.1, noNaN: true }),
      longitude: fastCheck.double({ min: -87.8, max: -87.4, noNaN: true }),
    });
    fastCheck.assert(
      fastCheck.property(
        coordinate,
        fastCheck.array(coordinate, { minLength: 1, maxLength: 6 }),
        (origin, vertices) => {
          const nearestVertex = nearestVertexDistance(origin, vertices);
          expect(distanceToLineMeters(origin, vertices)).toBeLessThanOrEqual(
            nearestVertex * 1.005 + 0.5,
          );
        },
      ),
    );
  });
});
