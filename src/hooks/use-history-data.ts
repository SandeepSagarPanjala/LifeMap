import {useCallback, useEffect, useRef, useState} from 'react';

import type {HistoryData} from '@/lib/history-data-types';
import {
  historyCacheKey,
  historyDataCache,
} from '@/lib/history-data-cache';
import {getDayHistoryFingerprint} from '@/lib/history-fingerprint';
import type {CoalescedLoadOptions} from '@/lib/history-day-load';
import {useTripDetectionConfig} from '@/hooks/use-trip-detection-config';
import {getDayRange, getTodayDateKey} from '@/lib/day-utils';
import type {TripDetectionConfig} from '@/lib/trip-settings';
import {useAppStore} from '@/stores/app-store';

export type {HistoryData} from '@/lib/history-data-types';

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
  options?: CoalescedLoadOptions,
): Promise<HistoryData> {
  const cacheKey = historyCacheKey(dateKey, detectionConfig);
  const fingerprint = await getDayHistoryFingerprint(dateKey);
  const cached = historyDataCache.read(cacheKey, dateKey);
  const cachedFingerprint = historyDataCache.getFingerprint(dateKey);
  const canUseCache =
    !options?.force &&
    cached != null &&
    cachedFingerprint === fingerprint;

  if (canUseCache) {
    return cached;
  }

  const result = await loadHistoryForDay(dateKey, detectionConfig, options);
  historyDataCache.write(cacheKey, result, fingerprint);
  return result;
}

export function useHistoryForDay(dateKey: string): {
  data: HistoryData;
  loading: boolean;
  error: string | null;
  refresh: () => void;
} {
  const detectionConfig = useTripDetectionConfig();
  const mapRefreshNonce = useAppStore(state => state.mapRefreshNonce);
  const initialCacheKey = historyCacheKey(dateKey, detectionConfig);
  const initialCached = historyDataCache.peek(initialCacheKey);
  const [data, setData] = useState<HistoryData>(
    initialCached ?? emptyForDateKey(dateKey),
  );
  const [loading, setLoading] = useState(
    initialCached == null || initialCached.dateKey !== dateKey,
  );
  const [error, setError] = useState<string | null>(null);
  const mapRefreshNonceRef = useRef(mapRefreshNonce);
  const loadGenerationRef = useRef(0);

  const runSync = useCallback(
    (targetDateKey: string, options?: {force?: boolean; showLoading?: boolean}) => {
      const generation = ++loadGenerationRef.current;
      if (options?.showLoading !== false) {
        setLoading(true);
      }
      setError(null);

      return syncHistoryForDay(targetDateKey, detectionConfig, {
        force: options?.force,
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
    void runSync(dateKey, {force: true, showLoading: true});
  }, [dateKey, runSync]);

  useEffect(() => {
    const cacheKey = historyCacheKey(dateKey, detectionConfig);
    const cached = historyDataCache.peek(cacheKey);
    if (cached != null) {
      setData(cached);
      setLoading(false);
      return;
    }
    setLoading(true);
    void runSync(dateKey, {showLoading: false}).catch(() => undefined);
  }, [dateKey, detectionConfig, runSync]);

  useEffect(() => {
    if (mapRefreshNonce === mapRefreshNonceRef.current) {
      return;
    }
    mapRefreshNonceRef.current = mapRefreshNonce;
    void runSync(dateKey, {force: true, showLoading: true}).catch(() => undefined);
  }, [dateKey, mapRefreshNonce, runSync]);

  return {data, loading, error, refresh};
}

/** @deprecated Use useHistoryForDay */
export function useHistoryData(): ReturnType<typeof useHistoryForDay> {
  return useHistoryForDay(getTodayDateKey());
}
