/**
 * Plain-words line about the live OpenStreetMap source (spec 2 R12). Pure: it reads the merged
 * result of loading every source and says what is on screen, with the reason when live data failed.
 */
import type { MergedBuildings } from './source-types.ts';
import { LIVE_SOURCE_ID } from './overpass-parse.ts';
export interface LiveLine {
  /** True when a Retry button belongs next to the text. */
  failed: boolean;
  text: string;
}
export const LIVE_CHECKING_TEXT = 'Checking OpenStreetMap for current buildings...';
const STATIC_SOURCE_ID = 'static';
function savedDate(result: MergedBuildings): string {
  const saved = result.loaded.find((entry) => entry.id === STATIC_SOURCE_ID);
  return saved ? ` from ${saved.savedOn}` : '';
}
/** The failure reason text from the live source, or null when it did not fail. */
function liveReason(result: MergedBuildings): string | null {
  return result.failed.find((entry) => entry.id === LIVE_SOURCE_ID)?.reason ?? null;
}
export function describeLiveResult(result: MergedBuildings): LiveLine {
  const reason = liveReason(result);
  const live = result.loaded.find((entry) => entry.id === LIVE_SOURCE_ID);
  if (reason === null) {
    return live
      ? { failed: false, text: `Includes current OpenStreetMap buildings (${live.savedOn}).` }
      : { failed: false, text: '' };
  }
  const scope = live ? 'Live map data loaded for some areas only' : 'Live map data unavailable';
  const kept = live ? 'Other areas use' : 'Showing';
  return {
    failed: true,
    text: `${scope}: ${reason}. ${kept} the saved building data${savedDate(result)}.`,
  };
}
