/**
 * Plain words for one ranked place (spec 2 R18, R19, R22, R24). Only the level and the engine's
 * reasons are shown, never a number of birds or points. Pure logic, no DOM.
 */
import type { RankedCandidate } from './place-ranking.ts';
import type { RiskLevel } from './types.ts';
export const UNNAMED_BUILDING = 'Unnamed building';
export const LIGHTING_NOTE = 'Lighting not known. The level assumes the lights are on.';
export interface PlaceDescription {
  id: string;
  name: string;
  level: RiskLevel;
  reasons: string[];
  /** For example "45 m tall", or undefined when the height is not known. */
  heightText?: string;
  /** For example "Not known: height, glass share". Undefined when everything scored is known. */
  missingText?: string;
  lightingNote?: string;
  isSample: boolean;
  /** Why a hand-picked site is on the list. */
  hotspotReason?: string;
}
const MISSING_WORDS: Record<string, string> = {
  litGlassArea: 'glass share',
  heightMeters: 'height',
};
function nameOf(entry: RankedCandidate): string {
  const name = entry.candidate.name?.trim();
  return name ? name : UNNAMED_BUILDING;
}
function heightTextOf(entry: RankedCandidate): string | undefined {
  const height = entry.candidate.place.heightMeters;
  return typeof height === 'number' && Number.isFinite(height)
    ? `${Math.round(height)} m tall`
    : undefined;
}
function missingTextOf(entry: RankedCandidate): string | undefined {
  const names = entry.missingInputs
    .filter((name) => name in MISSING_WORDS)
    .map((name) => MISSING_WORDS[name]);
  if (heightTextOf(entry) === undefined) {
    names.unshift('height');
  }
  return names.length > 0 ? `Not known: ${[...new Set(names)].join(', ')}` : undefined;
}
export function describePlace(entry: RankedCandidate): PlaceDescription {
  const { candidate } = entry;
  return {
    id: String(candidate.place.id),
    name: nameOf(entry),
    level: entry.level,
    reasons: entry.reasons,
    heightText: heightTextOf(entry),
    missingText: missingTextOf(entry),
    lightingNote: entry.assumesLit ? LIGHTING_NOTE : undefined,
    isSample: candidate.usesSampleValues,
    hotspotReason: candidate.hotspot?.reason,
  };
}
