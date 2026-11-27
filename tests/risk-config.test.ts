import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import { DEFAULT_CONFIG } from '../src/lib/risk-config.ts';

const researchTable = readFileSync(new URL('../docs/research.md', import.meta.url), 'utf8');
const KNOWN_EVIDENCE = new Set(
  [...researchTable.matchAll(/^\| (E\d+) \|/gm)].map((match) => match[1]),
);
const EVIDENCE_OR_ASSUMPTION = /^(E\d+|assumption)$/;

function everyEvidenceList(config) {
  const lists = Object.entries(config.weights).map(([name, entry]) => [
    `weights.${name}`,
    entry.evidence,
  ]);
  for (const key of [
    'nightParts',
    'lightMultiplier',
    'weatherOnly',
    'weatherScaling',
    'treatmentDiscount',
    'wind',
  ]) {
    lists.push([key, config[key].evidence]);
  }
  for (const [index, note] of config.notes.entries()) {
    lists.push([`notes[${index}]`, note.evidence]);
  }
  return lists;
}

describe('DEFAULT_CONFIG', () => {
  it('reads evidence IDs from docs/research.md (sanity check on the test itself)', () => {
    expect(KNOWN_EVIDENCE.has('E1')).toBe(true);
    expect(KNOWN_EVIDENCE.has('E21')).toBe(true);
  });

  it.each(everyEvidenceList(DEFAULT_CONFIG))(
    '%s cites real evidence or says assumption',
    (_name, evidence) => {
      expect(Array.isArray(evidence)).toBe(true);
      expect(evidence.length).toBeGreaterThan(0);
      for (const id of evidence) {
        expect(id).toMatch(EVIDENCE_OR_ASSUMPTION);
        if (id !== 'assumption') {
          expect(KNOWN_EVIDENCE.has(id)).toBe(true);
        }
      }
    },
  );

  it('is plain data that survives a JSON round trip (R30)', () => {
    expect(JSON.parse(JSON.stringify(DEFAULT_CONFIG))).toEqual(DEFAULT_CONFIG);
  });

  it('has night part weights that add up to 1 with the middle part highest (R37)', () => {
    const { early, middle, late } = DEFAULT_CONFIG.nightParts;
    expect(early + middle + late).toBeCloseTo(1, 9);
    expect(middle).toBeGreaterThan(early);
    expect(middle).toBeGreaterThan(late);
  });

  it('has ordered thresholds and migration bands inside 0 to 1', () => {
    const { elevated, high } = DEFAULT_CONFIG.thresholds;
    expect(elevated).toBeGreaterThan(0);
    expect(high).toBeGreaterThan(elevated);
    expect(high).toBeLessThanOrEqual(1);
    const { moderate, heavy } = DEFAULT_CONFIG.migrationBands;
    expect(moderate).toBeGreaterThan(0);
    expect(heavy).toBeGreaterThan(moderate);
    expect(heavy).toBeLessThanOrEqual(1);
  });

  it('keeps every wind sector and season date well formed', () => {
    for (const season of ['fall', 'spring']) {
      for (const [start, end] of DEFAULT_CONFIG.wind[season].unfavorableFrom) {
        expect(start).toBeGreaterThanOrEqual(0);
        expect(end).toBeLessThanOrEqual(360);
      }
    }
    for (const window of Object.values(DEFAULT_CONFIG.seasons)) {
      expect(window).toHaveLength(2);
      for (const monthDay of window) {
        expect(monthDay).toMatch(/^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/);
      }
      expect(window[0] < window[1]).toBe(true);
    }
  });

  it('has plain reason wording with no evidence IDs (R24)', () => {
    const reasons = Object.values(DEFAULT_CONFIG.reasons);
    expect(reasons.length).toBeGreaterThan(0);
    for (const text of reasons) {
      expect(text.trim().length).toBeGreaterThan(0);
      expect(text).not.toMatch(/\bE\d+\b/);
    }
  });

  it('has a dated note for the initial weights (R35)', () => {
    expect(DEFAULT_CONFIG.notes[0].date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(DEFAULT_CONFIG.notes[0].change.length).toBeGreaterThan(0);
  });
});
