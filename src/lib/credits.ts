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
  /** True when building footprints from the static extract are on screen (spec 2 R5). */
  usesBuildingData?: boolean;
}

const OVERTURE_CREDIT = {
  id: 'overture',
  text: 'Building data: Overture Maps Foundation, ODbL',
  href: 'https://docs.overturemaps.org/attribution/',
};
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
  usesBuildingData = false,
}: CreditSources = {}): CreditEntry[] {
  const hasDataset = typeof datasetAttribution === 'string' && datasetAttribution.trim() !== '';
  const wanted: [boolean, CreditEntry][] = [
    [hasDataset, { id: 'chicago-dataset', text: datasetAttribution ?? '' }],
    [usesBuildingData, { ...OVERTURE_CREDIT }],
    [usesMapData || usesBuildingData, { ...OPENSTREETMAP_CREDIT }],
  ];
  return wanted.filter(([include]) => include).map(([, entry]) => entry);
}
