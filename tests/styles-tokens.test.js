import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';

const tokensCss = readFileSync(new URL('../src/styles/tokens.css', import.meta.url), 'utf8');
const baseCss = readFileSync(new URL('../src/styles/base.css', import.meta.url), 'utf8');
const componentsCss = readFileSync(
  new URL('../src/styles/components.css', import.meta.url),
  'utf8',
);

function readTokens(css) {
  const tokens = {};
  for (const line of css.split('\n')) {
    const text = line.trim();
    const colon = text.indexOf(':');
    if (text.startsWith('--') && colon > 0 && text.endsWith(';')) {
      tokens[text.slice(0, colon)] = text.slice(colon + 1, -1).trim();
    }
  }
  return tokens;
}

const tokens = readTokens(tokensCss);

/** WCAG relative luminance of a #rrggbb color. */
function luminance(hex) {
  const channels = [1, 3, 5].map((start) => Number.parseInt(hex.slice(start, start + 2), 16) / 255);
  const [red, green, blue] = channels.map((value) =>
    value <= 0.039_28 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4,
  );
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

/** WCAG contrast ratio between two colors, from 1 to 21. */
function contrast(firstName, secondName) {
  const [lighter, darker] = [luminance(tokens[firstName]), luminance(tokens[secondName])].sort(
    (first, second) => second - first,
  );
  return (lighter + 0.05) / (darker + 0.05);
}

const SURFACES = ['--color-bg', '--color-surface', '--color-surface-raised'];
const TEXT_COLORS = [
  '--color-text',
  '--color-text-muted',
  '--color-accent',
  '--color-risk-low',
  '--color-risk-elevated',
  '--color-risk-high',
  '--color-sample',
];
const textPairs = SURFACES.flatMap((surface) => TEXT_COLORS.map((color) => [color, surface]));

describe('theme tokens', () => {
  it('reads every color as a #rrggbb value', () => {
    for (const [name, value] of Object.entries(tokens)) {
      if (name.startsWith('--color-')) {
        expect(value, name).toMatch(/^#[0-9a-f]{6}$/i);
      }
    }
  });

  it('keeps the night-airport look: dark navy surfaces and a warm amber accent (product rule)', () => {
    for (const surface of SURFACES) {
      expect(luminance(tokens[surface]), surface).toBeLessThan(0.03);
      const blue = Number.parseInt(tokens[surface].slice(5, 7), 16);
      const red = Number.parseInt(tokens[surface].slice(1, 3), 16);
      expect(blue, surface).toBeGreaterThan(red);
    }
    const accent = tokens['--color-accent'];
    expect(Number.parseInt(accent.slice(1, 3), 16)).toBeGreaterThan(
      Number.parseInt(accent.slice(5, 7), 16),
    );
  });

  it.each(textPairs)('%s on %s has contrast of at least 4.5:1 (R3)', (color, surface) => {
    expect(contrast(color, surface)).toBeGreaterThanOrEqual(4.5);
  });

  it('keeps dark text on the amber button at least 4.5:1, also on hover', () => {
    expect(contrast('--color-on-accent', '--color-accent')).toBeGreaterThanOrEqual(4.5);
    expect(contrast('--color-on-accent', '--color-accent-strong')).toBeGreaterThanOrEqual(4.5);
  });

  it.each(SURFACES)('keeps control edges and the focus ring at least 3:1 on %s', (surface) => {
    expect(contrast('--color-control-edge', surface)).toBeGreaterThanOrEqual(3);
    expect(contrast('--color-focus', surface)).toBeGreaterThanOrEqual(3);
  });

  it('sets the control size to at least 44 px and type to at least 16 px (R4)', () => {
    expect(Number.parseInt(tokens['--control-min-size'], 10)).toBeGreaterThanOrEqual(44);
    expect(tokens['--control-min-size']).toMatch(/px$/);
    for (const name of ['--font-size-base', '--font-size-small', '--font-size-large']) {
      expect(Number.parseFloat(tokens[name]) * 16, name).toBeGreaterThanOrEqual(16);
    }
  });
});

describe('base styles', () => {
  it('give every kind of interactive control the minimum size from the token (R4)', () => {
    const rule = baseCss.slice(
      baseCss.indexOf('/* R4'),
      baseCss.indexOf('}', baseCss.indexOf('/* R4')),
    );
    for (const selector of ['button', "[role='button']", 'a.control', 'select', 'summary']) {
      expect(rule).toContain(selector);
    }
    expect(rule).toContain('min-width: var(--control-min-size)');
    expect(rule).toContain('min-height: var(--control-min-size)');
  });

  it('use only colors from the tokens, never a hard-coded color', () => {
    expect(baseCss).not.toMatch(/#[0-9a-f]{3,8}\b/i);
    expect(baseCss).not.toMatch(/\brgb\(/i);
  });

  it('show a visible keyboard focus ring', () => {
    expect(baseCss).toMatch(/:focus-visible\s*\{[^}]*outline:\s*3px solid var\(--color-focus\)/);
  });
});

describe('component styles', () => {
  it('use only colors from the tokens, never a hard-coded color', () => {
    expect(componentsCss).not.toMatch(/#[0-9a-f]{3,8}\b/i);
    expect(componentsCss).not.toMatch(/\brgb\(/i);
  });

  it('only use token colors that were checked for contrast against every surface', () => {
    const used = new Set(
      [...componentsCss.matchAll(/var\((--color-[a-z-]+)\)/g)].map((match) => match[1]),
    );
    const checked = new Set([...TEXT_COLORS, '--color-control-edge', '--color-focus']);
    for (const name of used) {
      expect(checked.has(name), name).toBe(true);
    }
  });

  it('style a badge for every tone the code can produce', () => {
    for (const tone of ['live', 'replay', 'sample', 'notice']) {
      expect(componentsCss).toContain(`data-tone='${tone}'`);
    }
    for (const level of ['low', 'elevated', 'high']) {
      expect(componentsCss).toContain(`.risk-${level}`);
    }
  });
});
