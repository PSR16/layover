import { describe, it, expect } from 'vitest';
import { assessNight, assessPlace, rankPlaces, createRiskEngine } from '../src/lib/risk.js';
import { ConfigValidationError } from '../src/lib/risk-config-validate.js';
import { NIGHT_FACTORS } from '../src/lib/risk-night-factors.js';
import { PLACE_FACTORS } from '../src/lib/risk-place-factors.js';

const rough = { windFromDegrees: 200, windSpeedMps: 9, lowCloudPercent: 90, visibilityKm: 3 };
const clear = { windFromDegrees: 10, windSpeedMps: 2, lowCloudPercent: 5, visibilityKm: 15 };
const everywhere = (fields) => ({ early: fields, middle: fields, late: fields });
const conditions = (overrides = {}) => ({
  night: '2026-10-16',
  migration: { level: 1 },
  weather: everywhere(rough),
  ...overrides,
});
const venue = (overrides = {}) => ({
  id: 'venue',
  kind: 'arena',
  lit: true,
  litGlassArea: 1,
  treeNear: true,
  heightMeters: 30,
  lakeDistanceMeters: 300,
  ...overrides,
});

describe('assessNight', () => {
  it('rates a full-migration night with rough weather as high', () => {
    const result = assessNight(conditions());
    expect(result.level).toBe('high');
    expect(result.reasons.length).toBeGreaterThan(0);
  });

  it('returns only the documented fields, with no number outside trace and internal (R9)', () => {
    const result = assessNight(conditions());
    expect(Object.keys(result).sort()).toEqual(
      ['configVersion', 'internal', 'level', 'missingInputs', 'reasons', 'trace'].sort(),
    );
    expect(['low', 'elevated', 'high']).toContain(result.level);
    for (const reason of result.reasons) {
      expect(typeof reason).toBe('string');
      expect(reason).not.toMatch(/\bE\d+\b|\d/);
    }
  });

  it('gives a plain "quiet" reason when nothing applies (R24)', () => {
    const result = assessNight({
      night: '2026-01-10',
      migration: { level: 0 },
      weather: everywhere(clear),
    });
    expect(result.level).toBe('low');
    expect(result.reasons).toEqual(['Conditions look quiet for migrating birds.']);
  });

  it('lists a trace line for every night factor', () => {
    const ids = assessNight(conditions()).trace.map((line) => line.factorId);
    expect(ids).toEqual(NIGHT_FACTORS.map((factor) => factor.id));
  });

  it('rates spring low visibility at least elevated even with no migration data (E2, R15)', () => {
    const result = assessNight({
      night: '2026-04-20',
      weather: everywhere({ ...clear, visibilityKm: 2 }),
    });
    expect(result.level).not.toBe('low');
    expect(result.missingInputs).toContain('migration');
  });

  it('raises unfavorable weather on a light-migration night to elevated, never high (R15)', () => {
    const result = assessNight(conditions({ migration: { level: 0.05 } }));
    expect(result.level).toBe('elevated');
    expect(result.reasons).toContain('Weather alone raises the level to elevated.');
  });

  it('holds a night with no migration data to elevated at most and says so (R22)', () => {
    const result = assessNight(conditions({ migration: undefined }));
    expect(result.level).not.toBe('high');
    expect(result.missingInputs).toContain('migration');
    expect(result.reasons.some((reason) => reason.startsWith('No migration estimate'))).toBe(true);
  });

  it('still returns a result with almost nothing known (R22)', () => {
    const result = assessNight({ night: '2026-10-16' });
    expect(result.missingInputs).toEqual(['migration', 'visibility', 'wind']);
    expect(['low', 'elevated', 'high']).toContain(result.level);
  });

  it('throws a clear error when the night date is not an ISO date', () => {
    expect(() => assessNight({ night: 'tonight' })).toThrow(TypeError);
  });
});

describe('config overrides (R33)', () => {
  it('reports the config version used and applies overrides', () => {
    expect(assessNight(conditions()).configVersion).toBe('0.1.0');
    const result = assessNight(conditions(), { version: '0.1.1', thresholds: { high: 0.95 } });
    expect(result.configVersion).toBe('0.1.1');
    expect(result.level).toBe('elevated');
  });

  it('gives the same result for an empty override as for none', () => {
    expect(assessNight(conditions(), {})).toEqual(assessNight(conditions()));
  });

  it('rejects an override that breaks the research rules', () => {
    expect(() => assessNight(conditions(), { weights: { height: { weight: 0.9 } } })).toThrow(
      ConfigValidationError,
    );
  });
});

describe('assessPlace', () => {
  it('rates a lit arena on a heavy night as high with place reasons', () => {
    const result = assessPlace(venue(), conditions());
    expect(result.level).toBe('high');
    expect(result.reasons).toContain('Stadium or large light installation.');
    expect(result.reasons).toContain('Large areas of lit glass.');
  });

  it('lists a trace line for every night and place factor', () => {
    const ids = assessPlace(venue(), conditions()).trace.map((line) => line.factorId);
    expect(ids).toEqual([...NIGHT_FACTORS, ...PLACE_FACTORS].map((factor) => factor.id));
  });

  it('holds a very lit place to elevated at most when migration is missing (R22)', () => {
    const result = assessPlace(venue(), conditions({ migration: undefined }));
    expect(result.level).not.toBe('high');
  });

  it('applies the cloud and visibility multiplier to light factors only (R14)', () => {
    const rainy = assessPlace(venue(), conditions());
    const dry = assessPlace(
      venue(),
      conditions({ weather: everywhere({ ...rough, lowCloudPercent: 5, visibilityKm: 15 }) }),
    );
    const contribution = (result, id) =>
      result.trace.find((line) => line.factorId === id).contribution;
    expect(contribution(rainy, 'litGlass')).toBeGreaterThan(contribution(dry, 'litGlass'));
    expect(contribution(rainy, 'height')).toBeCloseTo(contribution(dry, 'height'), 9);
  });

  it('cuts the contribution of treated glass, and says why (R40)', () => {
    const total = (status) =>
      assessPlace(venue({ birdSafeTreatment: status }), conditions()).internal.totalPoints;
    expect(total('partial')).toBeLessThan(total('none'));
    expect(total('full')).toBeLessThan(total('partial'));
    expect(total(undefined)).toBeCloseTo(total('none'), 9);
    const full = assessPlace(venue({ birdSafeTreatment: 'full' }), conditions());
    expect(full.reasons).toContain('Bird-safe treatment on the glass lowers the risk here.');
    expect(assessPlace(venue(), conditions()).reasons).not.toContain(
      'Bird-safe treatment on the glass lowers the risk here.',
    );
  });
});

describe('rankPlaces (R25)', () => {
  const places = [
    venue({ id: 'b-glass', kind: 'building', litGlassArea: 0.6 }),
    venue({ id: 'a-arena' }),
    venue({ id: 'c-treated', birdSafeTreatment: 'full' }),
    venue({ id: 'd-dark', lit: false }),
  ];

  it('puts the highest risk first and the lowest last', () => {
    const order = rankPlaces(places, conditions()).map((entry) => entry.place.id);
    expect(order[0]).toBe('a-arena');
    expect(order.at(-1)).toBe('d-dark');
  });

  it('breaks exact ties by id', () => {
    const twins = [venue({ id: 'zeta' }), venue({ id: 'alpha' })];
    expect(rankPlaces(twins, conditions()).map((entry) => entry.place.id)).toEqual([
      'alpha',
      'zeta',
    ]);
  });

  it('does not change the input list and gives the same order every time', () => {
    const copy = structuredClone(places);
    const first = rankPlaces(places, conditions()).map((entry) => entry.place.id);
    const second = rankPlaces(places, conditions()).map((entry) => entry.place.id);
    expect(places).toEqual(copy);
    expect(first).toEqual(second);
  });
});

describe('adding a factor (R31)', () => {
  const dummy = {
    id: 'dummy',
    group: 'place',
    evidence: ['assumption'],
    reasonKeys: ['stadium'],
    evaluate: () => ({ id: 'dummy', group: 'place', points: 0.05, reasonKey: null, missing: [] }),
  };

  it('adds one trace line and leaves every other line unchanged', () => {
    const base = assessPlace(venue(), conditions());
    const engine = createRiskEngine({
      nightFactors: NIGHT_FACTORS,
      placeFactors: [...PLACE_FACTORS, dummy],
    });
    const extended = engine.assessPlace(venue(), conditions());
    expect(extended.trace.slice(0, -1)).toEqual(base.trace);
    expect(extended.trace.at(-1)).toMatchObject({ factorId: 'dummy', contribution: 0.05 });
  });

  it('refuses to start when a factor needs wording the config does not have', () => {
    const needy = { ...dummy, reasonKeys: ['notInConfig'] };
    expect(() => createRiskEngine({ nightFactors: NIGHT_FACTORS, placeFactors: [needy] })).toThrow(
      ConfigValidationError,
    );
  });
});
