import { describe, it, expect } from 'vitest';
import fastCheck from 'fast-check';
import { DEFAULT_ROUTE, ROUTES, resolveRoute } from '../src/lib/route.ts';

describe('resolveRoute (R1, R2)', () => {
  it('recognizes the two views', () => {
    expect(resolveRoute('#volunteer')).toEqual({
      name: 'volunteer',
      hash: '#volunteer',
      isFallback: false,
    });
    expect(resolveRoute('#org')).toEqual({ name: 'org', hash: '#org', isFallback: false });
  });

  it('falls back to the volunteer view for an empty, missing or unknown hash', () => {
    for (const hash of [
      '',
      '#',
      '#unknown',
      '#Org',
      '#org/',
      '#org?x=1',
      'org',
      '#/org',
      undefined,
      null,
      42,
    ]) {
      expect(resolveRoute(hash), String(hash)).toEqual({
        name: 'volunteer',
        hash: '#volunteer',
        isFallback: true,
      });
    }
  });

  it('always returns a known view and a matching hash (property)', () => {
    fastCheck.assert(
      fastCheck.property(fastCheck.string(), (text) => {
        const route = resolveRoute(`#${text}`);
        expect(ROUTES).toContain(route.name);
        expect(route.hash).toBe(`#${route.name}`);
        expect(route.isFallback).toBe(!ROUTES.includes(text));
      }),
    );
  });

  it('uses volunteer as the default view', () => {
    expect(DEFAULT_ROUTE).toBe('volunteer');
    expect(ROUTES).toEqual(['volunteer', 'org']);
  });
});
