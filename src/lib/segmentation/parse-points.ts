import type {LocationPointRow} from '@/db/repositories/location-days';

import {dateKeyForTimestamp} from './day-bounds';
import type {ParsedPoint} from './types';

export function locationRowsToParsedPoints(
  rows: readonly LocationPointRow[],
): ParsedPoint[] {
  return rows.map(row => ({
    ...row,
    at: row.timestamp,
    dateKey: dateKeyForTimestamp(row.timestamp),
  }));
}
