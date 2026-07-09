import { ensureHistoryCalendarBounds } from '@/lib/history-calendar-bounds';
import { getTodayDateKey, shiftDateKey } from '@/lib/day-utils';

let cachedDateKeys: { today: string; keys: string[] } | null = null;

/** Clear in-memory cache (tests / day rollover). */
export function clearBenchmarkDateKeysCache(): void {
  cachedDateKeys = null;
}

/**
 * Selectable benchmark days: earliest history bound → today.
 * Same range as the map date picker — one cached MIN query, no per-day counts.
 */
export async function listBenchmarkDateKeys(): Promise<string[]> {
  const today = getTodayDateKey();
  if (cachedDateKeys?.today === today) {
    return cachedDateKeys.keys;
  }

  const earliest = await ensureHistoryCalendarBounds();
  const keys: string[] = [];
  let cursor = earliest;
  while (cursor <= today) {
    keys.push(cursor);
    if (cursor === today) {
      break;
    }
    cursor = shiftDateKey(cursor, 1);
  }

  cachedDateKeys = { today, keys };
  return keys;
}
