import {useCallback, useRef, useState} from 'react';
import {useFocusEffect} from '@react-navigation/native';

import {
  getLocationPointsForDay,
  getLocationPointsInRange,
  type LocationPointRow,
} from '@/db/repositories/location-days';
import {getDayRange, getTodayDateKey} from '@/lib/day-utils';
import type {DayTimelineEntry} from '@/lib/trip-detection';
import type {HistoryTimeRange} from '@/lib/history-timeline';
import {
  getTodayHistoryLookbackStart,
  prepareTodayHistoryTimeline,
} from '@/lib/today-history';
import {useTripDetectionConfig} from '@/hooks/use-trip-detection-config';
import type {TripDetectionConfig} from '@/lib/trip-settings';

export type HistoryData = {
  points: LocationPointRow[];
  entries: DayTimelineEntry[];
  range: HistoryTimeRange;
};

const EMPTY: HistoryData = {
  points: [],
  entries: [],
  range: {startAt: new Date(), endAt: new Date()},
};

async function loadHistoryData(
  detectionConfig: TripDetectionConfig,
): Promise<HistoryData> {
  const todayKey = getTodayDateKey();
  const {start: dayStart} = getDayRange(todayKey);
  const rangeEnd = new Date();
  const lookbackStart = getTodayHistoryLookbackStart(dayStart);
  const [todayPoints, lookbackPoints] = await Promise.all([
    getLocationPointsForDay(todayKey),
    getLocationPointsInRange(
      lookbackStart,
      new Date(dayStart.getTime() - 1),
    ),
  ]);
  const entries = prepareTodayHistoryTimeline(
    todayPoints,
    lookbackPoints,
    dayStart,
    rangeEnd,
    detectionConfig,
  );

  return {
    points: todayPoints,
    entries,
    range: {
      startAt: dayStart,
      endAt: rangeEnd,
    },
  };
}

export function useHistoryData(): {
  data: HistoryData;
  loading: boolean;
  refresh: () => void;
} {
  const detectionConfig = useTripDetectionConfig();
  const [data, setData] = useState<HistoryData>(EMPTY);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(() => {
    setLoading(true);
    void loadHistoryData(detectionConfig)
      .then(setData)
      .finally(() => setLoading(false));
  }, [detectionConfig]);

  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setLoading(true);
      void loadHistoryData(detectionConfig)
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
    }, [detectionConfig]),
  );

  return {data, loading, refresh};
}
