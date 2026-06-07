import {useCallback, useEffect, useRef, useState} from 'react';
import {useFocusEffect} from '@react-navigation/native';
import {endOfDay} from 'date-fns';
import {AppState, type AppStateStatus} from 'react-native';

import {
  getLocationDayFingerprint,
  getLocationPointsForDay,
  getLocationPointsInRange,
  type LocationPointRow,
} from '@/db/repositories/location-days';
import {getDayRange, getTodayDateKey} from '@/lib/day-utils';
import type {DayTimelineEntry} from '@/lib/trip-detection';
import type {HistoryTimeRange} from '@/lib/history-timeline';
import {
  getHistoryLookbackStart,
  prepareDayHistoryTimeline,
} from '@/lib/today-history';
import {useTripDetectionConfig} from '@/hooks/use-trip-detection-config';
import type {TripDetectionConfig} from '@/lib/trip-settings';

export type HistoryData = {
  dateKey: string;
  points: LocationPointRow[];
  entries: DayTimelineEntry[];
  range: HistoryTimeRange;
};

const EMPTY: HistoryData = {
  dateKey: getTodayDateKey(),
  points: [],
  entries: [],
  range: {startAt: new Date(), endAt: new Date()},
};

const historyCache = new Map<string, HistoryData>();
const fingerprintCache = new Map<string, string>();

function historyCacheKey(
  dateKey: string,
  detectionConfig: TripDetectionConfig,
): string {
  return `${dateKey}:${detectionConfig.dwellMinutes}:${detectionConfig.dwellRadiusMeters}`;
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
  const cached = historyCache.get(cacheKey);
  const cachedFingerprint = fingerprintCache.get(dateKey);
  const canUseCache =
    !options?.force &&
    cached != null &&
    cachedFingerprint === fingerprint;

  if (canUseCache) {
    return cached;
  }

  const result = await loadHistoryForDay(dateKey, detectionConfig);
  historyCache.set(cacheKey, result);
  fingerprintCache.set(dateKey, fingerprint);
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
    fingerprintCache.get(dateKey) === fingerprint &&
    historyCache.has(cacheKey)
  ) {
    return null;
  }

  return syncHistoryForDay(dateKey, detectionConfig);
}

export function useHistoryForDay(dateKey: string): {
  data: HistoryData;
  loading: boolean;
  refresh: () => void;
} {
  const detectionConfig = useTripDetectionConfig();
  const [data, setData] = useState<HistoryData>(EMPTY);
  const [loading, setLoading] = useState(true);
  const dateKeyRef = useRef(dateKey);
  const detectionConfigRef = useRef(detectionConfig);
  dateKeyRef.current = dateKey;
  detectionConfigRef.current = detectionConfig;

  const applySync = useCallback(
    (options?: {force?: boolean}) => {
      setLoading(true);
      return syncHistoryForDay(dateKey, detectionConfig, options)
        .then(setData)
        .finally(() => setLoading(false));
    },
    [dateKey, detectionConfig],
  );

  const refresh = useCallback(() => {
    void applySync({force: true});
  }, [applySync]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;

      void syncHistoryForDay(dateKey, detectionConfig)
        .then(result => {
          if (!cancelled) {
            setData(result);
          }
        })
        .finally(() => {
          if (!cancelled) {
            setLoading(false);
          }
        });

      return () => {
        cancelled = true;
      };
    }, [dateKey, detectionConfig]),
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
      ).then(result => {
        if (result != null) {
          setData(result);
        }
      });
    };

    const subscription = AppState.addEventListener('change', onAppStateChange);
    return () => subscription.remove();
  }, []);

  return {data, loading, refresh};
}

/** @deprecated Use useHistoryForDay */
export function useHistoryData(): ReturnType<typeof useHistoryForDay> {
  return useHistoryForDay(getTodayDateKey());
}
