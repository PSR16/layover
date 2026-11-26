/**
 * Turn window lighting records into a lit share from 0 to 1 (R39; E1, E7).
 * Codes follow the Chicago collision dataset (see docs/data-profile.md): only `YN`
 * (lights on and visible from outside) counts as lit. Dim, covered, off and unknown
 * windows count as unlit. `QN` (questionable record) is left out of the share.
 */

const LIT_CODE = 'YN';
const QUESTIONABLE_CODE = 'QN';

function cleanCode(code) {
  return String(code ?? '')
    .trim()
    .toUpperCase();
}

export function isLitCode(code) {
  return cleanCode(code) === LIT_CODE;
}

function usableWindows(windows) {
  return windows
    .filter((window) => cleanCode(window.code) !== QUESTIONABLE_CODE)
    .map((window) => ({ code: window.code, size: Number.isFinite(window.size) ? window.size : 1 }))
    .filter((window) => window.size > 0);
}

/**
 * Share of window size that is lit.
 * @param {{ code: string, size?: number }[]} windows size defaults to 1 (equal windows)
 * @returns {number | undefined} undefined when there is nothing to measure
 */
export function litShare(windows) {
  const usable = usableWindows(windows ?? []);
  const total = usable.reduce((sum, window) => sum + window.size, 0);
  if (total === 0) {
    return undefined;
  }
  const lit = usable.filter((window) => isLitCode(window.code));
  return lit.reduce((sum, window) => sum + window.size, 0) / total;
}
