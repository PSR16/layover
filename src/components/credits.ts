/** The credits block shown on both views (R36). Built with DOM calls and textContent. */
import type { CreditEntry } from '../lib/types.ts';

/**
 * @param {Document} page
 * @param {{ id: string, text: string, href?: string }[]} credits
 * @returns {HTMLElement | null} null when there is nothing to credit
 */
export function createCredits(page: Document, credits: CreditEntry[]): HTMLElement | null {
  if (credits.length === 0) {
    return null;
  }
  const footer = page.createElement('footer');
  footer.className = 'credits';
  const heading = page.createElement('h2');
  heading.className = 'credits-title';
  heading.textContent = 'Credits';
  const list = page.createElement('ul');
  for (const credit of credits) {
    const item = page.createElement('li');
    item.dataset.credit = credit.id;
    if (credit.href) {
      const link = page.createElement('a');
      link.href = credit.href;
      link.rel = 'noopener noreferrer';
      link.target = '_blank';
      link.textContent = credit.text;
      item.append(link);
    } else {
      item.textContent = credit.text;
    }
    list.append(item);
  }
  footer.append(heading, list);
  return footer;
}
