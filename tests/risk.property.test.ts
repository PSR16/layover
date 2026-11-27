import { describe, it, expect } from 'vitest';
import fastCheck from 'fast-check';
import { assessNight, assessPlace, rankPlaces } from '../src/lib/risk.ts';
import { levelRank } from '../src/lib/risk-combine.ts';

const NIGHTS = ['2026-10-16', '2026-04-20', '2026-01-10'];
const maybe = (arbitrary) => fastCheck.option(arbitrary, { nil: undefined });
const between = (min, max) => fastCheck.double({ min, max, noNaN: true });

const readingArbitrary = fastCheck.record({
  windFromDegrees: maybe(between(0, 360)),
  windSpeedMps: maybe(between(0, 25)),
  lowCloudPercent: maybe(between(0, 100)),
  visibilityKm: maybe(between(0, 25)),
});
const weatherArbitrary = maybe(
  fastCheck.record({ early: readingArbitrary, middle: readingArbitrary, late: readingArbitrary }),
);
const migrationArbitrary = maybe(fastCheck.record({ level: between(0, 1) }));
const placeArbitrary = fastCheck.record({
  id: fastCheck.uuid(),
  kind: fastCheck.constantFrom('building', 'stadium', 'arena', 'installation'),
  lit: maybe(fastCheck.boolean()),
  litGlassArea: maybe(between(0, 1)),
  treeNear: maybe(fastCheck.boolean()),
  heightMeters: maybe(between(0, 400)),
  lakeDistanceMeters: maybe(fastCheck.option(between(0, 4000))),
  birdSafeTreatment: maybe(fastCheck.constantFrom('none', 'partial', 'full')),
});
const conditionsArbitrary = fastCheck.record({
  night: fastCheck.constantFrom(...NIGHTS),
  migration: migrationArbitrary,
  weather: weatherArbitrary,
});

const rank = (result) => levelRank(result.level);
const isPlainReason = (text) => typeof text === 'string' && text.length > 0;
const withMigration = (conditions, level) => ({ ...conditions, migration: { level } });
const roughReading = {
  windFromDegrees: 200,
  windSpeedMps: 12,
  lowCloudPercent: 95,
  visibilityKm: 1,
};
const roughWeather = { early: roughReading, middle: roughReading, late: roughReading };

describe('risk engine properties', () => {
  it('always returns one of three levels and at least one plain reason (R9, R24)', () => {
    fastCheck.assert(
      fastCheck.property(placeArbitrary, conditionsArbitrary, (place, conditions) => {
        for (const result of [assessNight(conditions), assessPlace(place, conditions)]) {
          expect(['low', 'elevated', 'high']).toContain(result.level);
          expect(result.reasons.length).toBeGreaterThan(0);
          expect(result.reasons.every(isPlainReason)).toBe(true);
        }
      }),
    );
  });

  it('gives the same result for the same input (determinism)', () => {
    fastCheck.assert(
      fastCheck.property(placeArbitrary, conditionsArbitrary, (place, conditions) => {
        expect(assessPlace(place, conditions)).toEqual(assessPlace(place, conditions));
      }),
    );
  });

  it('never lowers the level when migration rises (R11)', () => {
    fastCheck.assert(
      fastCheck.property(
        placeArbitrary,
        conditionsArbitrary,
        between(0, 1),
        between(0, 1),
        (place, conditions, first, second) => {
          const low = withMigration(conditions, Math.min(first, second));
          const high = withMigration(conditions, Math.max(first, second));
          expect(rank(assessNight(high))).toBeGreaterThanOrEqual(rank(assessNight(low)));
          expect(rank(assessPlace(place, high))).toBeGreaterThanOrEqual(
            rank(assessPlace(place, low)),
          );
        },
      ),
    );
  });

  it('never lowers the level when lit glass area rises (R12)', () => {
    fastCheck.assert(
      fastCheck.property(
        placeArbitrary,
        conditionsArbitrary,
        between(0, 1),
        between(0, 1),
        (place, conditions, first, second) => {
          const dim = assessPlace({ ...place, litGlassArea: Math.min(first, second) }, conditions);
          const bright = assessPlace(
            { ...place, litGlassArea: Math.max(first, second) },
            conditions,
          );
          expect(rank(bright)).toBeGreaterThanOrEqual(rank(dim));
          expect(bright.internal.totalPoints).toBeGreaterThanOrEqual(
            dim.internal.totalPoints - 1e-12,
          );
        },
      ),
    );
  });

  it('never rates a light-migration night high, for a night or any place (R15)', () => {
    fastCheck.assert(
      fastCheck.property(
        placeArbitrary,
        conditionsArbitrary,
        between(0, 0.39),
        (place, conditions, level) => {
          const light = withMigration(conditions, level);
          expect(assessNight(light).level).not.toBe('high');
          expect(assessPlace(place, light).level).not.toBe('high');
        },
      ),
    );
  });

  it('rates at least elevated when migration is minimal and weather is clearly unfavorable (R15)', () => {
    fastCheck.assert(
      fastCheck.property(
        placeArbitrary,
        fastCheck.constantFrom('2026-10-16', '2026-04-20'),
        (place, night) => {
          const conditions = { night, migration: { level: 0 }, weather: roughWeather };
          expect(rank(assessNight(conditions))).toBeGreaterThanOrEqual(levelRank('elevated'));
          expect(rank(assessPlace(place, conditions))).toBeGreaterThanOrEqual(
            levelRank('elevated'),
          );
        },
      ),
    );
  });

  it('gives fall at least as many points as spring when all else is equal (R19)', () => {
    fastCheck.assert(
      fastCheck.property(migrationArbitrary, (migration) => {
        const fall = assessNight({ night: '2026-10-16', migration });
        const spring = assessNight({ night: '2026-04-20', migration });
        expect(fall.internal.totalPoints).toBeGreaterThanOrEqual(spring.internal.totalPoints);
      }),
    );
  });

  it('ignores facade compass direction (R21)', () => {
    fastCheck.assert(
      fastCheck.property(
        placeArbitrary,
        conditionsArbitrary,
        between(0, 360),
        (place, conditions, direction) => {
          const facing = { ...place, facadeDirection: direction, compassDirection: direction };
          expect(assessPlace(facing, conditions)).toEqual(assessPlace(place, conditions));
        },
      ),
    );
  });

  it('still returns a result when any single input is removed, and names what is missing (R22)', () => {
    fastCheck.assert(
      fastCheck.property(conditionsArbitrary, (conditions) => {
        const withoutMigration = assessNight({ ...conditions, migration: undefined });
        const withoutWeather = assessNight({ ...conditions, weather: undefined });
        expect(withoutMigration.missingInputs).toContain('migration');
        expect(withoutWeather.missingInputs).toContain('visibility');
        expect(['low', 'elevated', 'high']).toContain(withoutWeather.level);
      }),
    );
  });

  it('holds a night with no migration data to elevated at most (R22)', () => {
    fastCheck.assert(
      fastCheck.property(placeArbitrary, conditionsArbitrary, (place, conditions) => {
        const unknown = { ...conditions, migration: undefined };
        expect(assessNight(unknown).level).not.toBe('high');
        expect(assessPlace(place, unknown).level).not.toBe('high');
      }),
    );
  });

  it('never raises points when treatment goes from none to partial to full (R40)', () => {
    fastCheck.assert(
      fastCheck.property(placeArbitrary, conditionsArbitrary, (place, conditions) => {
        const points = (status) =>
          assessPlace({ ...place, birdSafeTreatment: status }, conditions).internal.totalPoints;
        expect(points('partial')).toBeLessThanOrEqual(points('none') + 1e-12);
        expect(points('full')).toBeLessThanOrEqual(points('partial') + 1e-12);
      }),
    );
  });

  it('ranks the same places in the same order whatever order they arrive in (R25)', () => {
    fastCheck.assert(
      fastCheck.property(
        fastCheck.uniqueArray(placeArbitrary, { selector: (place) => place.id, maxLength: 8 }),
        conditionsArbitrary,
        fastCheck.integer({ min: 0, max: 1000 }),
        (places, conditions, seed) => {
          const shuffled = [...places].sort((first, second) =>
            first.id + seed > second.id + seed ? 1 : -1,
          );
          const order = (list) => rankPlaces(list, conditions).map((entry) => entry.place.id);
          expect(order(shuffled)).toEqual(order(places));
        },
      ),
    );
  });
});
