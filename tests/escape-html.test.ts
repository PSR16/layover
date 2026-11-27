import { describe, it, expect } from 'vitest';
import fastCheck from 'fast-check';
import { escapeHtml } from '../src/lib/escape-html.ts';

describe('escapeHtml', () => {
  it('escapes the five HTML-special characters', () => {
    expect(escapeHtml(`<a href="x">Tom & 'Jo'</a>`)).toBe(
      '&lt;a href=&quot;x&quot;&gt;Tom &amp; &#39;Jo&#39;&lt;/a&gt;',
    );
  });

  it('never leaves raw angle brackets or quotes in its output', () => {
    fastCheck.assert(
      fastCheck.property(fastCheck.string(), (text) => {
        expect(escapeHtml(text)).not.toMatch(/[<>"']/);
      }),
    );
  });
});
