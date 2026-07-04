import {useCallback, useEffect, useRef, useState} from 'react';
import {APP_COPY} from '@/lib/app-copy';

import type {HistoryData} from '@/lib/history-data-types';
import {
  clearHistoryDataCache,
  historyCacheKey,
  historyDataCache,
  TODAY_LIVE_FINGERPRINT,
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
import {getCurrentOpenActivity} from '@/lib/today-history';
import {
  subscribeTodayHistoryRefresh,
  updateTodayRefreshAfterSync,
} from '@/lib/today-refresh-scheduler';

export type {HistoryData} from '@/lib/history-data-types';

/** Wait for rapid calendar day taps to settle before hitting the database. */
import {HISTORY_DAY_LOAD_DEBOUNCE_MS} from '@/lib/app-constants';

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

function shouldRejectEmptyTodayWipe(
  dateKey: string,
  next: HistoryData,
  previous: HistoryData | null | undefined,
): boolean {
  if (dateKey !== getTodayDateKey()) {
    return false;
  }
  if (next.entries.length > 0) {
    return false;
  }
  if (previous == null || previous.dateKey !== dateKey) {
    return false;
  }
  return previous.entries.length > 0;
}

function commitHistoryData(
  dateKey: string,
  next: HistoryData,
  previous: HistoryData,
  setData: (data: HistoryData) => void,
): HistoryData {
  if (shouldRejectEmptyTodayWipe(dateKey, next, previous)) {
    return previous;
  }
  setData(next);
  return next;
}

function syncTodayRefreshMode(
  dateKey: string,
  entries: HistoryData['entries'],
  detectionConfig: TripDetectionConfig,
): void {
  if (dateKey !== getTodayDateKey()) {
    updateTodayRefreshAfterSync(null);
    return;
  }
  updateTodayRefreshAfterSync(
    getCurrentOpenActivity(entries, {config: detectionConfig}),
  );
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

  if (isToday && !options?.force) {
    const cachedToday = historyDataCache.peek(cacheKey);
    if (
      cachedToday != null &&
      cachedToday.dateKey === dateKey &&
      cachedToday.entries.length > 0
    ) {
      void loadHistoryForDay(dateKey, detectionConfig, options).then(result => {
        if (
          options?.loadGeneration != null &&
          !isCurrentHistoryDayLoad(options.loadGeneration)
        ) {
          return;
        }
        if (shouldRejectEmptyTodayWipe(dateKey, result, cachedToday)) {
          return;
        }
        historyDataCache.write(cacheKey, result, TODAY_LIVE_FINGERPRINT);
        syncTodayRefreshMode(dateKey, result.entries, detectionConfig);
      });
      syncTodayRefreshMode(dateKey, cachedToday.entries, detectionConfig);
      return cachedToday;
    }
  }

  let writeFingerprint = TODAY_LIVE_FINGERPRINT;
  if (!isToday) {
    writeFingerprint = await getDayHistoryFingerprint(dateKey);
    const cached = historyDataCache.read(cacheKey, dateKey);
    const cachedFingerprint = historyDataCache.getFingerprint(dateKey);
    const canUseCache =
      !options?.force &&
      cached != null &&
      cachedFingerprint === writeFingerprint;

    if (canUseCache) {
      return cached;
    }
  }

  const result = await loadHistoryForDay(dateKey, detectionConfig, options);
  if (
    options?.loadGeneration != null &&
    !isCurrentHistoryDayLoad(options.loadGeneration)
  ) {
    return result;
  }
  if (isToday) {
    const cachedToday = historyDataCache.peek(cacheKey);
    if (shouldRejectEmptyTodayWipe(dateKey, result, cachedToday)) {
      const kept = cachedToday ?? result;
      syncTodayRefreshMode(dateKey, kept.entries, detectionConfig);
      return kept;
    }
  }
  historyDataCache.write(cacheKey, result, writeFingerprint);
  if (isToday) {
    syncTodayRefreshMode(dateKey, result.entries, detectionConfig);
  }
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
  const dataRef = useRef(data);
  dataRef.current = data;
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
      if (!isToday) {
        updateTodayRefreshAfterSync(null);
      }
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
          const committed = commitHistoryData(
            targetDateKey,
            partial,
            dataRef.current,
            setData,
          );
          syncTodayRefreshMode(
            targetDateKey,
            committed.entries,
            detectionConfig,
          );
          setLoading(false);
        },
      })
        .then(result => {
          if (generation !== loadGenerationRef.current) {
            return result;
          }
          const committed = commitHistoryData(
            targetDateKey,
            result,
            dataRef.current,
            setData,
          );
          syncTodayRefreshMode(
            targetDateKey,
            committed.entries,
            detectionConfig,
          );
          return committed;
        })
        .catch((cause: unknown) => {
          if (generation !== loadGenerationRef.current) {
            throw cause;
          }
          const message =
            cause instanceof Error
              ? cause.message
              : APP_COPY.alerts.couldNotLoadDay;
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
