// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import { RADAR_ATTRIBUTION } from '../src/data/replay-nights.ts';
import { createBadge, createRiskBadge } from '../src/components/badge.ts';
import { createCredits } from '../src/components/credits.ts';
import { buildCredits } from '../src/lib/credits.ts';

const HOSTILE = '<img src=x onerror="alert(1)"><script>alert(2)</script> & "quotes"';

describe('createBadge (R5, R6)', () => {
  it('shows the text and the tone', () => {
    const badge = createBadge(document, { text: 'Sample data', tone: 'sample' });
    expect(badge.tagName).toBe('SPAN');
    expect(badge.textContent).toBe('Sample data');
    expect(badge.dataset.tone).toBe('sample');
    expect(badge.classList.contains('badge')).toBe(true);
  });

  it('never turns text into markup', () => {
    const badge = createBadge(document, { text: HOSTILE, tone: 'notice' });
    expect(badge.children).toHaveLength(0);
    expect(badge.textContent).toBe(HOSTILE);
    expect(badge.innerHTML).not.toContain('<img');
    expect(badge.innerHTML).not.toContain('<script');
  });

  it('uses the notice tone for an unknown tone', () => {
    expect(createBadge(document, { text: 'x', tone: 'neon' }).dataset.tone).toBe('notice');
  });
});

describe('createRiskBadge', () => {
  it.each([
    ['low', 'Low'],
    ['elevated', 'Elevated'],
    ['high', 'High'],
  ])('shows the word for %s and a spoken label', (level, word) => {
    const badge = createRiskBadge(document, level);
    expect(badge.textContent).toBe(word);
    expect(badge.classList.contains(`risk-${level}`)).toBe(true);
    expect(badge.getAttribute('aria-label')).toBe(`Risk: ${level}`);
  });

  it('refuses a level that is not low, elevated or high, and shows no number', () => {
    expect(() => createRiskBadge(document, 'severe')).toThrow(TypeError);
    for (const level of ['low', 'elevated', 'high']) {
      expect(createRiskBadge(document, level).textContent).not.toMatch(/\d/);
    }
  });
});

describe('createCredits (R36)', () => {
  it('returns nothing when there is nothing to credit', () => {
    expect(createCredits(document, [])).toBeNull();
  });

  it('shows the dataset attribution text in full', () => {
    const footer = createCredits(document, buildCredits({ datasetAttribution: RADAR_ATTRIBUTION }));
    expect(footer.querySelector('h2').textContent).toBe('Credits');
    const text = footer.querySelector('[data-credit="chicago-dataset"]').textContent;
    expect(text).toBe(RADAR_ATTRIBUTION);
    expect(text).toContain('10.17632/mjvt3yxdkv.2');
    expect(text).toContain('CC BY 4.0');
    expect(text).toContain('do not endorse');
  });

  it('links the OpenStreetMap credit safely, in a new tab', () => {
    const footer = createCredits(document, buildCredits({ usesMapData: true }));
    const link = footer.querySelector('a');
    expect(link.textContent).toBe('© OpenStreetMap contributors');
    expect(link.getAttribute('href')).toBe('https://www.openstreetmap.org/copyright');
    expect(link.getAttribute('rel')).toBe('noopener noreferrer');
    expect(link.getAttribute('target')).toBe('_blank');
  });

  it('never turns credit text into markup', () => {
    const footer = createCredits(document, [{ id: 'x', text: HOSTILE }]);
    expect(footer.querySelectorAll('img, script')).toHaveLength(0);
    expect(footer.querySelector('li').textContent).toBe(HOSTILE);
  });

  it('uses no logo or image', () => {
    const footer = createCredits(
      document,
      buildCredits({ datasetAttribution: RADAR_ATTRIBUTION, usesMapData: true }),
    );
    expect(footer.querySelectorAll('img, svg, picture')).toHaveLength(0);
  });
});
