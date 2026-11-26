/** Shape every risk factor returns: { id, group, points, reasonKey, missing }. */
export function factorResult(id, group, points, details = {}) {
  const { reasonKey = null, missing = [] } = details;
  return { id, group, points, reasonKey, missing };
}

/** Clamp a number into 0 to 1. */
export function clampShare(value) {
  return Math.min(Math.max(value, 0), 1);
}
