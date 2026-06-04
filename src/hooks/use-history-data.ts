import {useCallback, useState} from 'react';
import {useFocusEffect} from '@react-navigation/native';
import {endOfDay} from 'date-fns';

import {
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

export function useHistoryForDay(dateKey: string): {
  data: HistoryData;
  loading: boolean;
  refresh: () => void;
} {
  const detectionConfig = useTripDetectionConfig();
  const [data, setData] = useState<HistoryData>(EMPTY);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(() => {
    setLoading(true);
    void loadHistoryForDay(dateKey, detectionConfig)
      .then(setData)
      .finally(() => setLoading(false));
  }, [dateKey, detectionConfig]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setLoading(true);
      void loadHistoryForDay(dateKey, detectionConfig)
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

  return {data, loading, refresh};
}

/** @deprecated Use useHistoryForDay */
export function useHistoryData(): ReturnType<typeof useHistoryForDay> {
  return useHistoryForDay(getTodayDateKey());
}
