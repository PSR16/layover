/**
 * Small labelled badges. Text is always set with textContent, so no data can inject markup (R5).
 * A badge always carries words, never color alone.
 */
import { BADGE_TONES, riskWord } from '../lib/data-labels.ts';
import type { Badge, RiskLevel } from '../lib/types.ts';

/**
 * @param {Document} page
 * @param {{ text: string, tone: 'live' | 'replay' | 'sample' | 'notice' }} badge
 */
export function createBadge(page: Document, { text, tone }: Badge): HTMLElement {
  const element = page.createElement('span');
  element.className = 'badge';
  element.dataset.tone = BADGE_TONES.includes(tone) ? tone : 'notice';
  element.textContent = text;
  return element;
}

/** A risk badge: the word Low, Elevated or High, with the level as a class and a spoken label. */
export function createRiskBadge(page: Document, level: RiskLevel): HTMLElement {
  const element = page.createElement('span');
  element.className = `badge risk-badge risk-${level}`;
  element.textContent = riskWord(level);
  element.setAttribute('aria-label', `Risk: ${level}`);
  return element;
}
