import {useCallback, useRef, useState} from 'react';
import {useFocusEffect} from '@react-navigation/native';

import {
  getDaySummaries,
  getHomeLocationData,
  getHistoricalOnThisDaySummaries,
  getLocationPointsForDay,
  type DaySummary,
  type HomeLocationData,
  type LocationPointRow,
} from '@/db/repositories/location-days';
import {getTodayDateKey} from '@/lib/day-utils';

const EMPTY_HOME: HomeLocationData = {
  daySummaries: [],
  todayPoints: [],
  onThisDaySummaries: [],
};

function useAsyncOnFocus<T>(loader: () => Promise<T>, initial: T): {
  data: T;
  loading: boolean;
  refresh: () => void;
} {
  const [data, setData] = useState<T>(initial);
  const [loading, setLoading] = useState(true);
  const loaderRef = useRef(loader);
  loaderRef.current = loader;

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setLoading(true);

      void loaderRef
        .current()
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
    }, []),
  );

  const refresh = useCallback(() => {
    setLoading(true);
    void loaderRef
      .current()
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  return {data, loading, refresh};
}

export function useHomeLocationData() {
  const todayKey = getTodayDateKey();
  const loader = useCallback(() => getHomeLocationData(todayKey), [todayKey]);
  return useAsyncOnFocus(loader, EMPTY_HOME);
}

export function useDaySummaries() {
  return useAsyncOnFocus(getDaySummaries, [] as DaySummary[]);
}

export function useLocationPointsForDay(dateKey: string) {
  const loader = useCallback(() => getLocationPointsForDay(dateKey), [dateKey]);
  return useAsyncOnFocus(loader, [] as LocationPointRow[]);
}

export function useTodayLocationPoints() {
  const todayKey = getTodayDateKey();
  const loader = useCallback(() => getLocationPointsForDay(todayKey), [todayKey]);
  return useAsyncOnFocus(loader, [] as LocationPointRow[]);
}

export function useOnThisDaySummaries() {
  const loader = useCallback(() => getHistoricalOnThisDaySummaries(new Date()), []);
  return useAsyncOnFocus(loader, [] as DaySummary[]);
}
