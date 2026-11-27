import { describe, it, expect } from 'vitest';
import { CHICAGO_RISK_LABEL, CHICAGO_RISK_OVERRIDES } from '../src/config/chicago-risk.js';
import { DEFAULT_CONFIG } from '../src/lib/risk-config.js';
import { mergeConfig } from '../src/lib/risk-config-validate.js';
import { assessNight } from '../src/lib/risk.js';

const wind = (degrees) => ({
  windFromDegrees: degrees,
  windSpeedMps: 9,
  lowCloudPercent: 5,
  visibilityKm: 15,
});
const everywhere = (reading) => ({ early: reading, middle: reading, late: reading });
const night = (date, degrees) => ({
  night: date,
  migration: { level: 0.9 },
  weather: everywhere(wind(degrees)),
});
const points = (conditions, overrides) => assessNight(conditions, overrides).internal.totalPoints;
const SPRING = '2026-04-20';
const FALL = '2026-10-16';

describe('Chicago risk overlay (R42)', () => {
  it('merges into a valid config and reports its own version', () => {
    const merged = mergeConfig(DEFAULT_CONFIG, CHICAGO_RISK_OVERRIDES);
    expect(merged.version).toBe('0.2.0-chicago-lakefront');
    expect(assessNight(night(FALL, 270), CHICAGO_RISK_OVERRIDES).configVersion).toBe(
      merged.version,
    );
  });

  it('keeps the default notes and adds one dated note that names the limits', () => {
    const { notes } = mergeConfig(DEFAULT_CONFIG, CHICAGO_RISK_OVERRIDES);
    expect(notes.slice(0, DEFAULT_CONFIG.notes.length)).toEqual(DEFAULT_CONFIG.notes);
    const added = notes.at(-1);
    expect(added.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(added.change).toMatch(/One site, untreated building/);
    expect(added.evidence).toEqual(['E1']);
  });

  it('changes only the wind sectors, version and notes', () => {
    const merged = mergeConfig(DEFAULT_CONFIG, CHICAGO_RISK_OVERRIDES);
    const { version, notes, wind: localWind, ...rest } = merged;
    const {
      version: defaultVersion,
      notes: defaultNotes,
      wind: defaultWind,
      ...defaultRest
    } = DEFAULT_CONFIG;
    expect(rest).toEqual(defaultRest);
    expect(localWind.strongMps).toBe(defaultWind.strongMps);
    expect(localWind.evidence).toEqual(defaultWind.evidence);
    expect([version, notes.length]).not.toEqual([defaultVersion, defaultNotes.length]);
  });

  it('does not change the default config', () => {
    const before = structuredClone(DEFAULT_CONFIG);
    mergeConfig(DEFAULT_CONFIG, CHICAGO_RISK_OVERRIDES);
    expect(DEFAULT_CONFIG).toEqual(before);
  });

  it('counts spring south wind as unfavorable, which the default sectors do not', () => {
    const south = night(SPRING, 180);
    expect(points(south, CHICAGO_RISK_OVERRIDES)).toBeGreaterThan(points(south));
  });

  it('counts spring north wind as unfavorable only under the default sectors', () => {
    const north = night(SPRING, 0);
    expect(points(north)).toBeGreaterThan(points(north, CHICAGO_RISK_OVERRIDES));
  });

  it('counts fall west wind as unfavorable under both, and fall south only under the default', () => {
    expect(points(night(FALL, 270), CHICAGO_RISK_OVERRIDES)).toBeCloseTo(
      points(night(FALL, 270)),
      9,
    );
    expect(points(night(FALL, 180))).toBeGreaterThan(
      points(night(FALL, 180), CHICAGO_RISK_OVERRIDES),
    );
  });

  it('gives a label to show wherever the overlay is applied (P3)', () => {
    expect(CHICAGO_RISK_LABEL).toBe('Chicago lakefront, one site, untreated building');
  });
});
