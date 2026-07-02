import {dateKeyForTimestamp, coerceTimestamp} from './day-bounds';
import type {ParsedPoint, RawLocationPoint} from './types';

export function rawRowsToParsedPoints(
  rows: readonly RawLocationPoint[],
): ParsedPoint[] {
  return rows.map(row => {
    const timestamp = coerceTimestamp(row.timestamp);
    return {
      ...row,
      timestamp,
      at: timestamp,
      dateKey: dateKeyForTimestamp(timestamp),
    };
  });
}

/** Alias for mobile DB rows (timestamps are already `Date`). */
export function locationRowsToParsedPoints(
  rows: readonly RawLocationPoint[],
): ParsedPoint[] {
  return rawRowsToParsedPoints(rows);
}
