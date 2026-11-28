/**
 * The one-line status for the live OpenStreetMap source (spec 2 R12), with a Retry button when it
 * failed. The saved list stays on screen the whole time; this line only reports on the live part.
 * All text goes in through textContent.
 */
import { describeLiveResult, LIVE_CHECKING_TEXT } from '../lib/live-status.ts';
import type { MergedBuildings } from '../lib/source-types.ts';
export interface LiveLine {
  /** Ask the live source and show the outcome. Resolves with the merged result, or null on a crash. */
  run: () => Promise<MergedBuildings | null>;
}
function textNode(page: Document, text: string): HTMLElement {
  const node = page.createElement('p');
  node.className = 'board-status';
  node.setAttribute('role', 'status');
  node.textContent = text;
  return node;
}
function retryButton(page: Document, onRetry: () => void): HTMLButtonElement {
  const button = page.createElement('button');
  button.type = 'button';
  button.className = 'live-retry';
  button.textContent = 'Retry';
  button.addEventListener('click', onRetry);
  return button;
}
export function createLiveLine(
  container: HTMLElement,
  load: () => Promise<MergedBuildings>,
  onResult: (result: MergedBuildings) => void,
  isStopped: () => boolean,
): LiveLine {
  const page = container.ownerDocument;
  const run = async (): Promise<MergedBuildings | null> => {
    container.replaceChildren(textNode(page, LIVE_CHECKING_TEXT));
    try {
      const result = await load();
      if (isStopped()) {
        return null;
      }
      const line = describeLiveResult(result);
      const nodes: HTMLElement[] = line.text ? [textNode(page, line.text)] : [];
      if (line.failed) {
        nodes.push(retryButton(page, () => void run()));
      }
      container.replaceChildren(...nodes);
      onResult(result);
      return result;
    } catch {
      if (!isStopped()) {
        container.replaceChildren(
          textNode(page, 'Live map data unavailable. Showing the saved building data.'),
          retryButton(page, () => void run()),
        );
      }
      return null;
    }
  };
  return { run };
}
