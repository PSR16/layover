import { describe, it, expect } from 'vitest';
import { LIGHTING_NOTE, UNNAMED_BUILDING, describePlace } from '../src/lib/place-description.ts';
const entry = (overrides = {}) => ({
  candidate: { place: { id: 'a', heightMeters: 44.6 }, usesSampleValues: false, hotspot: null },
  level: 'elevated',
  reasons: ['Migration is heavy.'],
  missingInputs: [],
  assumesLit: true,
  ...overrides,
});
describe('describePlace (R18, R22)', () => {
  it('names unnamed buildings and trims names', () => {
    expect(describePlace(entry()).name).toBe(UNNAMED_BUILDING);
    const named = entry();
    named.candidate = { ...named.candidate, name: '  Tower  ' };
    expect(describePlace(named).name).toBe('Tower');
  });
  it('rounds the height and reports a missing height and glass share in words', () => {
    expect(describePlace(entry()).heightText).toBe('45 m tall');
    const bare = entry({ missingInputs: ['litGlassArea'] });
    bare.candidate = { ...bare.candidate, place: { id: 'b' } };
    const description = describePlace(bare);
    expect(description.heightText).toBeUndefined();
    expect(description.missingText).toBe('Not known: height, glass share');
  });
  it('states the lighting assumption only while lighting is unknown', () => {
    expect(describePlace(entry()).lightingNote).toBe(LIGHTING_NOTE);
    expect(describePlace(entry({ assumesLit: false })).lightingNote).toBeUndefined();
  });
});
