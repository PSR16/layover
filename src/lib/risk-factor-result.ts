/** Shape every risk factor returns: { id, group, points, reasonKey, missing }. */
import type { FactorGroup, FactorOutput } from './types.ts';
export function factorResult(
  id: string,
  group: FactorGroup,
  points: number,
  details: { reasonKey?: string | null; missing?: string[] } = {},
): FactorOutput {
  const { reasonKey = null, missing = [] } = details;
  return { id, group, points, reasonKey, missing };
}

/** Clamp a number into 0 to 1. */
export function clampShare(value: number): number {
  return Math.min(Math.max(value, 0), 1);
}
