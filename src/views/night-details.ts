/**
 * The "Details" control under the board. It holds the labels that are not needed to read the
 * night (where the migration level came from, the city note) and the sample migration level
 * picker. It is built once, so it stays open while the board redraws.
 */
export interface DetailsSlots {
  root: HTMLElement;
  badges: HTMLElement;
  level: HTMLElement;
}
export function createDetails(page: Document): DetailsSlots {
  const root = page.createElement('details');
  root.className = 'details';
  const summary = page.createElement('summary');
  summary.textContent = 'Details';
  const badges = page.createElement('div');
  badges.className = 'board-badges';
  const level = page.createElement('div');
  root.append(summary, badges, level);
  return { root, badges, level };
}
