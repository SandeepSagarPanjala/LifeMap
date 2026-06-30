import {useCallback, useEffect, useRef, useState} from 'react';

import type {HistoryData} from '@/lib/history-data-types';
import {
  clearHistoryDataCache,
  historyCacheKey,
  historyDataCache,
} from '@/lib/history-data-cache';
import {getDayHistoryFingerprint} from '@/lib/history-fingerprint';
import {
  beginHistoryDayLoad,
  type CoalescedLoadOptions,
  isCurrentHistoryDayLoad,
} from '@/lib/history-day-load';
import {useTripDetectionConfig} from '@/hooks/use-trip-detection-config';
import type {TripDetectionConfig} from '@/lib/trip-settings';
import {getDayRange, getTodayDateKey} from '@/lib/day-utils';
import {subscribeSavedPlaces} from '@/lib/saved-places-events';
import {subscribeTodayHistoryRefresh} from '@/lib/today-refresh-scheduler';

export type {HistoryData} from '@/lib/history-data-types';

/** Wait for rapid calendar day taps to settle before hitting the database. */
const HISTORY_DAY_LOAD_DEBOUNCE_MS = 300;

export type UseHistoryForDayOptions = {
  /** When false, today is not loaded until the history panel opens. */
  active?: boolean;
  /** Read sealed trips from DB when opening history (no live GPS detection). */
  preferStored?: boolean;
};

function emptyForDateKey(dateKey: string): HistoryData {
  const {start: dayStart} = getDayRange(dateKey);
  return {
    dateKey,
    points: [],
    entries: [],
    range: {startAt: dayStart, endAt: dayStart},
  };
}

async function loadHistoryForDay(
  dateKey: string,
  detectionConfig: TripDetectionConfig,
  options?: CoalescedLoadOptions,
): Promise<HistoryData> {
  const {loadHistoryForDayCoalesced} = await import('@/lib/history-day-load');
  return loadHistoryForDayCoalesced(dateKey, detectionConfig, options);
}

async function syncHistoryForDay(
  dateKey: string,
  detectionConfig: TripDetectionConfig,
  options?: CoalescedLoadOptions & {loadGeneration?: number},
): Promise<HistoryData> {
  const cacheKey = historyCacheKey(dateKey, detectionConfig);
  const isToday = dateKey === getTodayDateKey();

  const fingerprint = await getDayHistoryFingerprint(dateKey);
  const cached = historyDataCache.read(cacheKey, dateKey);
  const cachedFingerprint = historyDataCache.getFingerprint(dateKey);
  const canUseCache =
    !options?.force &&
    !isToday &&
    cached != null &&
    cachedFingerprint === fingerprint;

  if (canUseCache) {
    return cached;
  }

  const result = await loadHistoryForDay(dateKey, detectionConfig, options);
  if (
    options?.loadGeneration != null &&
    !isCurrentHistoryDayLoad(options.loadGeneration)
  ) {
    return result;
  }
  historyDataCache.write(cacheKey, result, fingerprint);
  return result;
}

export function useHistoryForDay(
  dateKey: string,
  options: UseHistoryForDayOptions = {},
): {
  data: HistoryData;
  loading: boolean;
  error: string | null;
  refresh: () => void;
} {
  const {active = true, preferStored = false} = options;
  const detectionConfig = useTripDetectionConfig();
  const initialCacheKey = historyCacheKey(dateKey, detectionConfig);
  const initialCached = historyDataCache.peek(initialCacheKey);
  const [data, setData] = useState<HistoryData>(
    initialCached ?? emptyForDateKey(dateKey),
  );
  const [loading, setLoading] = useState(
    active && (initialCached == null || initialCached.dateKey !== dateKey),
  );
  const [error, setError] = useState<string | null>(null);
  const loadGenerationRef = useRef(0);

  const runSync = useCallback(
    (
      targetDateKey: string,
      syncOptions?: {
        force?: boolean;
        preferStored?: boolean;
        showLoading?: boolean;
      },
    ) => {
      const generation = beginHistoryDayLoad();
      loadGenerationRef.current = generation;
      const cached = historyDataCache.peek(
        historyCacheKey(targetDateKey, detectionConfig),
      );
      const hasTodaySnapshot =
        targetDateKey === getTodayDateKey() &&
        cached != null &&
        cached.dateKey === targetDateKey &&
        cached.entries.length > 0;
      const isToday = targetDateKey === getTodayDateKey();
      if (syncOptions?.showLoading !== false && !hasTodaySnapshot && !isToday) {
        setLoading(true);
      }
      setError(null);

      return syncHistoryForDay(targetDateKey, detectionConfig, {
        force: syncOptions?.force,
        preferStored: syncOptions?.preferStored,
        loadGeneration: generation,
        onPartial: partial => {
          if (generation !== loadGenerationRef.current) {
            return;
          }
          setData(partial);
          setLoading(false);
        },
      })
        .then(result => {
          if (generation !== loadGenerationRef.current) {
            return result;
          }
          setData(result);
          return result;
        })
        .catch((cause: unknown) => {
          if (generation !== loadGenerationRef.current) {
            throw cause;
          }
          const message =
            cause instanceof Error
              ? cause.message
              : 'Could not load this day';
          setError(message);
          throw cause;
        })
        .finally(() => {
          if (generation === loadGenerationRef.current) {
            setLoading(false);
          }
        });
    },
    [detectionConfig],
  );

  const refresh = useCallback(() => {
    void runSync(dateKey, {force: true, showLoading: true}).catch(() => undefined);
  }, [dateKey, runSync]);

  const viewingToday = dateKey === getTodayDateKey();

  useEffect(() => {
    if (!viewingToday) {
      return;
    }
    return subscribeTodayHistoryRefresh(() => {
      void runSync(dateKey, {
        force: false,
        preferStored: true,
        showLoading: false,
      }).catch(() => undefined);
    });
  }, [dateKey, runSync, viewingToday]);

  useEffect(() => {
    return subscribeSavedPlaces(() => {
      clearHistoryDataCache();
      void runSync(dateKey, {
        force: true,
        showLoading: false,
      }).catch(() => undefined);
    });
  }, [dateKey, runSync]);

  useEffect(() => {
    const cacheKey = historyCacheKey(dateKey, detectionConfig);
    const cached = historyDataCache.peek(cacheKey);

    if (!active) {
      setData(cached ?? emptyForDateKey(dateKey));
      setLoading(false);
      return;
    }

    if (cached != null && cached.dateKey === dateKey) {
      setData(cached);
      setLoading(false);
      if (!viewingToday) {
        return;
      }
    } else {
      setLoading(viewingToday ? false : true);
    }

    const debounceMs =
      cached != null && cached.dateKey === dateKey && viewingToday
        ? 0
        : HISTORY_DAY_LOAD_DEBOUNCE_MS;

    const timer = setTimeout(() => {
      void runSync(dateKey, {
        showLoading: cached == null || cached.dateKey !== dateKey,
        force: false,
        preferStored,
      }).catch(() => undefined);
    }, debounceMs);

    return () => clearTimeout(timer);
  }, [
    active,
    dateKey,
    detectionConfig,
    preferStored,
    runSync,
    viewingToday,
  ]);

  return {data, loading, error, refresh};
}

/** @deprecated Use useHistoryForDay */
export function useHistoryData(): ReturnType<typeof useHistoryForDay> {
  return useHistoryForDay(getTodayDateKey());
}
