import {useCallback, useEffect, useRef, useState} from 'react';
import {useFocusEffect} from '@react-navigation/native';
import {endOfDay} from 'date-fns';
import {AppState, InteractionManager, type AppStateStatus} from 'react-native';

import {
  getLocationDayFingerprint,
  getLocationPointsForDay,
  getLocationPointsInRange,
} from '@/db/repositories/location-days';
import {getDayRange, getTodayDateKey} from '@/lib/day-utils';
import type {HistoryData} from '@/lib/history-data-types';
import {
  historyCacheKey,
  historyDataCache,
} from '@/lib/history-data-cache';
import {
  getHistoryLookbackStart,
  prepareDayHistoryTimeline,
} from '@/lib/today-history';
import {useTripDetectionConfig} from '@/hooks/use-trip-detection-config';
import type {TripDetectionConfig} from '@/lib/trip-settings';

export type {HistoryData} from '@/lib/history-data-types';

const EMPTY: HistoryData = {
  dateKey: getTodayDateKey(),
  points: [],
  entries: [],
  range: {startAt: new Date(), endAt: new Date()},
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
): Promise<HistoryData> {
  const now = new Date();
  const {start: dayStart} = getDayRange(dateKey);
  const isToday = dateKey === getTodayDateKey();
  const rangeEnd = isToday ? now : endOfDay(dayStart);
  const lookbackStart = getHistoryLookbackStart(dayStart);
  const [dayPoints, lookbackPoints] = await Promise.all([
    getLocationPointsForDay(dateKey),
    getLocationPointsInRange(
      lookbackStart,
      new Date(dayStart.getTime() - 1),
    ),
  ]);
  const entries = prepareDayHistoryTimeline(
    dateKey,
    dayPoints,
    lookbackPoints,
    detectionConfig,
    now,
  );

  return {
    dateKey,
    points: dayPoints,
    entries,
    range: {
      startAt: dayStart,
      endAt: rangeEnd,
    },
  };
}

async function syncHistoryForDay(
  dateKey: string,
  detectionConfig: TripDetectionConfig,
  options?: {force?: boolean},
): Promise<HistoryData> {
  const cacheKey = historyCacheKey(dateKey, detectionConfig);
  const fingerprint = await getLocationDayFingerprint(dateKey);
  const cached = historyDataCache.read(cacheKey, dateKey);
  const cachedFingerprint = historyDataCache.getFingerprint(dateKey);
  const canUseCache =
    !options?.force &&
    cached != null &&
    cachedFingerprint === fingerprint;

  if (canUseCache) {
    return cached;
  }

  const result = await loadHistoryForDay(dateKey, detectionConfig);
  historyDataCache.write(cacheKey, result, fingerprint);
  return result;
}

/** Cheap DB check — skips trip detection when today's points are unchanged. */
async function reloadHistoryIfChanged(
  dateKey: string,
  detectionConfig: TripDetectionConfig,
): Promise<HistoryData | null> {
  const cacheKey = historyCacheKey(dateKey, detectionConfig);
  const fingerprint = await getLocationDayFingerprint(dateKey);
  if (
    historyDataCache.getFingerprint(dateKey) === fingerprint &&
    historyDataCache.has(cacheKey)
  ) {
    return null;
  }

  return syncHistoryForDay(dateKey, detectionConfig);
}

export function useHistoryForDay(dateKey: string): {
  data: HistoryData;
  loading: boolean;
  error: string | null;
  refresh: () => void;
} {
  const detectionConfig = useTripDetectionConfig();
  const initialCacheKey = historyCacheKey(dateKey, detectionConfig);
  const initialCached = historyDataCache.peek(initialCacheKey);
  const [data, setData] = useState<HistoryData>(
    initialCached ?? emptyForDateKey(dateKey),
  );
  const [loading, setLoading] = useState(initialCached == null);
  const [error, setError] = useState<string | null>(null);
  const dateKeyRef = useRef(dateKey);
  const detectionConfigRef = useRef(detectionConfig);
  dateKeyRef.current = dateKey;
  detectionConfigRef.current = detectionConfig;

  useEffect(() => {
    const cacheKey = historyCacheKey(dateKey, detectionConfig);
    const cached = historyDataCache.peek(cacheKey);
    if (cached != null) {
      setData(cached);
      setLoading(false);
      return;
    }
    setData(emptyForDateKey(dateKey));
    setLoading(true);
  }, [dateKey, detectionConfig]);

  const runSync = useCallback(
    (options?: {force?: boolean; showLoading?: boolean}) => {
      if (options?.showLoading) {
        setLoading(true);
      }
      setError(null);

      return syncHistoryForDay(dateKey, detectionConfig, options)
        .then(result => {
          setData(result);
          return result;
        })
        .catch((cause: unknown) => {
          const message =
            cause instanceof Error
              ? cause.message
              : 'Could not load this day';
          setError(message);
          throw cause;
        })
        .finally(() => {
          setLoading(false);
        });
    },
    [dateKey, detectionConfig],
  );

  const refresh = useCallback(() => {
    void runSync({force: true, showLoading: true});
  }, [runSync]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      const cacheKey = historyCacheKey(dateKey, detectionConfig);
      const hasCached = historyDataCache.has(cacheKey);

      if (!hasCached) {
        setLoading(true);
      }

      const run = () => {
        void runSync()
          .catch(() => undefined)
          .finally(() => {
            if (!cancelled) {
              setLoading(false);
            }
          });
      };

      const task = hasCached
        ? null
        : InteractionManager.runAfterInteractions(run);
      if (hasCached) {
        run();
      }

      return () => {
        cancelled = true;
        task?.cancel();
      };
    }, [dateKey, detectionConfig, runSync]),
  );

  useEffect(() => {
    let appState = AppState.currentState;

    const onAppStateChange = (nextState: AppStateStatus) => {
      const wasBackgrounded = appState === 'background' || appState === 'inactive';
      appState = nextState;

      if (nextState !== 'active' || !wasBackgrounded) {
        return;
      }

      void reloadHistoryIfChanged(
        dateKeyRef.current,
        detectionConfigRef.current,
      )
        .then(result => {
          if (result != null) {
            setData(result);
          }
        })
        .catch(() => undefined);
    };

    const subscription = AppState.addEventListener('change', onAppStateChange);
    return () => subscription.remove();
  }, []);

  return {data, loading, error, refresh};
}

/** @deprecated Use useHistoryForDay */
export function useHistoryData(): ReturnType<typeof useHistoryForDay> {
  return useHistoryForDay(getTodayDateKey());
}
