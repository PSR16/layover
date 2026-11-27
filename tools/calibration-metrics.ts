/**
 * Plain statistics for judging the risk engine against nightly bird counts: how well a score
 * ranks nights (AUC, Spearman), and how many birds fall on nights the engine flagged.
 * Pure functions, tested in tests/calibration-metrics.test.ts.
 */

/** Ranks from 1 up, with tied values sharing the average of their ranks. */
export function ranksOf(values) {
  const order = values
    .map((value, index) => ({ value, index }))
    .sort((first, second) => first.value - second.value);
  const ranks = new Array(values.length);
  let start = 0;
  while (start < order.length) {
    let end = start;
    while (end + 1 < order.length && order[end + 1].value === order[start].value) {
      end += 1;
    }
    const average = (start + end) / 2 + 1;
    for (let position = start; position <= end; position += 1) {
      ranks[order[position].index] = average;
    }
    start = end + 1;
  }
  return ranks;
}

/** Spearman rank correlation between two lists, or undefined when either has no spread. */
export function spearman(first, second) {
  const rankFirst = ranksOf(first);
  const rankSecond = ranksOf(second);
  const meanFirst = rankFirst.reduce((sum, value) => sum + value, 0) / rankFirst.length;
  const meanSecond = rankSecond.reduce((sum, value) => sum + value, 0) / rankSecond.length;
  let covariance = 0;
  let varianceFirst = 0;
  let varianceSecond = 0;
  for (const [index, value] of rankFirst.entries()) {
    const deltaFirst = value - meanFirst;
    const deltaSecond = rankSecond[index] - meanSecond;
    covariance += deltaFirst * deltaSecond;
    varianceFirst += deltaFirst ** 2;
    varianceSecond += deltaSecond ** 2;
  }
  const denominator = Math.sqrt(varianceFirst * varianceSecond);
  return denominator === 0 ? undefined : covariance / denominator;
}

/**
 * Area under the ROC curve: the chance that a random positive night scores higher than a random
 * negative night (ties count half). 0.5 is no better than chance, 1 is perfect.
 */
export function auc(scores, positives) {
  const ranks = ranksOf(scores);
  let positiveCount = 0;
  let rankSum = 0;
  for (const [index, isPositive] of positives.entries()) {
    if (isPositive) {
      positiveCount += 1;
      rankSum += ranks[index];
    }
  }
  const negativeCount = scores.length - positiveCount;
  if (positiveCount === 0 || negativeCount === 0) {
    return undefined;
  }
  return (rankSum - (positiveCount * (positiveCount + 1)) / 2) / (positiveCount * negativeCount);
}

/** Share of all birds found on the top `fraction` of nights when ranked by `scores`. */
export function topShare(scores, birds, fraction) {
  const total = birds.reduce((sum, value) => sum + value, 0);
  if (total === 0) {
    return undefined;
  }
  const count = Math.max(1, Math.round(scores.length * fraction));
  const order = scores
    .map((score, index) => ({ score, index }))
    .sort((first, second) => second.score - first.score || first.index - second.index);
  const captured = order.slice(0, count).reduce((sum, entry) => sum + birds[entry.index], 0);
  return captured / total;
}

/** For each level: share of nights and share of birds. */
export function levelBreakdown(levels, birds) {
  const total = birds.reduce((sum, value) => sum + value, 0);
  const result = {};
  for (const level of ['low', 'elevated', 'high']) {
    const indexes = levels.flatMap((entry, index) => (entry === level ? [index] : []));
    const found = indexes.reduce((sum, index) => sum + birds[index], 0);
    result[level] = {
      nights: indexes.length / levels.length,
      birds: total === 0 ? 0 : found / total,
      meanBirds: indexes.length === 0 ? 0 : found / indexes.length,
    };
  }
  return result;
}
