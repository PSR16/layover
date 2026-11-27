/**
 * Visible labels for data that is not live, real measurements (R6, R7). Every screen that shows
 * sample, replayed or sample-derived data shows one of these. A badge is { text, tone }.
 * Pure logic: src/components/badge.ts turns a badge into an element.
 */
import type { Badge, BadgeTone, RiskLevel } from './types.ts';
import { effectiveSource } from './data-source.ts';

export const BADGE_TONES: readonly BadgeTone[] = ['live', 'replay', 'sample', 'notice'];

const SOURCE_TEXT = { live: 'Live data', replay: 'Replay night', sample: 'Sample data' };

/** Badge for a night or record. Uses the record's own label when it has one (replay nights do). */
export function nightBadge(
  record: { source?: unknown; label?: unknown } | null | undefined,
): Badge {
  const source = effectiveSource(record);
  const text =
    typeof record?.label === 'string' && record.label !== '' ? record.label : SOURCE_TEXT[source];
  return { text, tone: source };
}

/** Badge for how the migration level was obtained. Anything not marked as radar is sample. */
export function migrationBadge(migration: { source?: unknown } | null | undefined): Badge {
  if (migration?.source === 'replay') {
    return { text: 'Radar-derived migration', tone: 'replay' };
  }
  return { text: 'Sample migration level', tone: 'sample' };
}

/**
 * Badge for a weather result from the weather client: live weather names its provider, saved
 * weather says "Saved weather", and anything else says "Weather unavailable" (R28, R29).
 */
export function weatherBadge(
  weatherResult: { source?: unknown; label?: string } | null | undefined,
): Badge {
  if (weatherResult?.source === 'live') {
    return { text: weatherResult.label ?? 'Live weather', tone: 'live' };
  }
  if (weatherResult?.source === 'saved') {
    return { text: 'Saved weather', tone: 'notice' };
  }
  return { text: 'Weather unavailable', tone: 'notice' };
}

const RISK_WORDS: Record<RiskLevel, string> = { low: 'Low', elevated: 'Elevated', high: 'High' };

/** The word shown for a risk level. Risk is only ever low, elevated or high (product rule). */
export function riskWord(level: unknown): string {
  if (typeof level !== 'string' || !Object.hasOwn(RISK_WORDS, level)) {
    throw new TypeError(`Unknown risk level: ${String(level)}`);
  }
  return RISK_WORDS[level as RiskLevel];
}
