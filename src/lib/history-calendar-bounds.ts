import { getEarliestLocationDateKey } from '@/db/repositories/location-days';
import { getSetting, setSetting } from '@/db/repositories/settings';
import { getTodayDateKey } from '@/lib/day-utils';
import { useAppStore } from '@/stores/app-store';

const SETTINGS_KEY_HISTORY_EARLIEST_DATE = 'history_earliest_date_key';

let boundsPromise: Promise<string> | null = null;

/** Earliest selectable calendar day — first GPS row or app install, cached in settings. */
export async function ensureHistoryCalendarBounds(): Promise<string> {
  const cached = useAppStore.getState().historyEarliestDateKey;
  if (cached != null) {
    return cached;
  }

  if (boundsPromise != null) {
    return boundsPromise;
  }

  boundsPromise = (async () => {
    const stored = await getSetting(SETTINGS_KEY_HISTORY_EARLIEST_DATE);
    if (stored != null && stored.length > 0) {
      useAppStore.getState().setHistoryEarliestDateKey(stored);
      return stored;
    }

    const fromDb = await getEarliestLocationDateKey();
    const earliest = fromDb ?? getTodayDateKey();
    await setSetting(SETTINGS_KEY_HISTORY_EARLIEST_DATE, earliest);
    useAppStore.getState().setHistoryEarliestDateKey(earliest);
    return earliest;
  })().finally(() => {
    boundsPromise = null;
  });

  return boundsPromise;
}

export function clampDateKeyToHistoryBounds(dateKey: string): string {
  const earliest =
    useAppStore.getState().historyEarliestDateKey ?? getTodayDateKey();
  const today = getTodayDateKey();
  if (dateKey < earliest) {
    return earliest;
  }
  if (dateKey > today) {
    return today;
  }
  return dateKey;
}
