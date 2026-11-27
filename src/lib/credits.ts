/**
 * The credits both views show (R36). The Chicago dataset credit (CC BY 4.0) appears whenever a
 * value derived from it is used, and the OpenStreetMap credit whenever map or building data is.
 * The credits are plain text and links to the source, with no logos and no wording that suggests
 * partnership or endorsement (product rule).
 */
import type { CreditEntry } from './types.ts';

interface CreditSources {
  datasetAttribution?: string;
  usesMapData?: boolean;
}

const OPENSTREETMAP_CREDIT = {
  id: 'openstreetmap',
  text: '© OpenStreetMap contributors',
  href: 'https://www.openstreetmap.org/copyright',
};

/**
 * @param {{ datasetAttribution?: string, usesMapData?: boolean }} used
 * @returns {{ id: string, text: string, href?: string }[]}
 */
export function buildCredits({
  datasetAttribution,
  usesMapData = false,
}: CreditSources = {}): CreditEntry[] {
  const credits = [];
  if (typeof datasetAttribution === 'string' && datasetAttribution.trim() !== '') {
    credits.push({ id: 'chicago-dataset', text: datasetAttribution });
  }
  if (usesMapData) {
    credits.push({ ...OPENSTREETMAP_CREDIT });
  }
  return credits;
}
