import {getTodayDateKey} from '@/lib/day-utils';

import {useDayMoments} from './use-day-moments';

/** @deprecated Use useDayMoments(getTodayDateKey()) */
export function useTodayMoments() {
  const todayKey = getTodayDateKey();
  const {dayMoments, refreshDayMoments} = useDayMoments(todayKey);
  return {
    mapMoments: dayMoments,
    refreshTodayMoments: refreshDayMoments,
  };
}
