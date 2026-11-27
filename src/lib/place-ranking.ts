/**
 * Scores place candidates for one night and puts them in order (spec 2 R17 to R20). The order is
 * the engine's: level first, then its internal points, then the id, so it never depends on the
 * input order. Only the level, the plain reasons and the missing-input names leave this module:
 * no points and no counts (R19). Pure logic, no DOM or network.
 */
import type { PlaceCandidate } from './place-builder.ts';
import { rankPlaces } from './risk.ts';
import type { Conditions, RiskConfigOverrides, RiskLevel } from './types.ts';
export interface RankedCandidate {
  candidate: PlaceCandidate;
  level: RiskLevel;
  reasons: string[];
  missingInputs: string[];
  /** True while lighting is unknown: the engine counts an unset place as lit (spec 2 R18). */
  assumesLit: boolean;
}
/** Candidates ranked for a night, highest risk first. The input list is not changed. */
export function rankCandidates(
  candidates: PlaceCandidate[],
  conditions: Conditions,
  overrides?: RiskConfigOverrides,
): RankedCandidate[] {
  const byId = new Map(candidates.map((candidate) => [String(candidate.place.id), candidate]));
  const ranked = rankPlaces(
    candidates.map((candidate) => candidate.place),
    conditions,
    overrides,
  );
  return ranked.map(({ place, result }) => ({
    candidate: byId.get(String(place.id)) as PlaceCandidate,
    level: result.level,
    reasons: result.reasons,
    missingInputs: result.missingInputs,
    assumesLit: place.lit === undefined,
  }));
}
