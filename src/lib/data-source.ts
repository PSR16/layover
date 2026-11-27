/**
 * Where a piece of data came from (R7): `live`, `replay` or `sample`.
 * A record with a missing or unknown source counts as `sample`, so made-up data is never shown
 * as real by mistake (product rule: sample data is always labelled).
 */
import type { DataSource } from './types.ts';

export const DATA_SOURCES: readonly DataSource[] = ['live', 'replay', 'sample'];

/** The source to use for a record, defaulting to `sample`. */
export function effectiveSource(record: { source?: unknown } | null | undefined): DataSource {
  const source = record?.source;
  return DATA_SOURCES.includes(source as DataSource) ? (source as DataSource) : 'sample';
}
