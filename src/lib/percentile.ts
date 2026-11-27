/**
 * Percentile rank: where a value sits among a set of values, from 0 (lowest) to 1 (highest).
 * Used to turn raw radar bird densities into a 0 to 1 migration level within a season, so the
 * scale does not depend on radar units (R26).
 *
 * A value's rank is the share of values below it plus half the share equal to it, so ties get
 * the middle of their range and every rank stays strictly between 0 and 1.
 */

function usableValues(values: readonly unknown[]): number[] {
  return values
    .filter((value): value is number => Number.isFinite(value))
    .sort((first, second) => first - second);
}

/** How many sorted values are below the value, or at most the value when `inclusive`. */
function countBefore(sorted: number[], value: number, inclusive: boolean): number {
  let low = 0;
  let high = sorted.length;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    const goesBefore = inclusive ? sorted[middle] <= value : sorted[middle] < value;
    if (goesBefore) {
      low = middle + 1;
    } else {
      high = middle;
    }
  }
  return low;
}

/**
 * Build a function that ranks any number against the given values.
 * @returns {(value: number) => number | undefined} undefined when there is nothing to rank
 */
export function percentileRanker(
  values: readonly unknown[],
): (value: number) => number | undefined {
  const sorted = usableValues(values);
  return (value) => {
    if (sorted.length === 0 || !Number.isFinite(value)) {
      return undefined;
    }
    const below = countBefore(sorted, value, false);
    const equal = countBefore(sorted, value, true) - below;
    return (below + equal / 2) / sorted.length;
  };
}
