import {useCallback, useEffect, useState} from 'react';
import {useFocusEffect} from '@react-navigation/native';

import {getMomentsForDay, type MomentRow} from '@/db/repositories/moments';
import {getDayRange} from '@/lib/day-utils';

export function useDayMoments(dateKey: string) {
  const [dayMoments, setDayMoments] = useState<MomentRow[]>([]);

  const refresh = useCallback(async () => {
    const {start, end} = getDayRange(dateKey);
    const rows = await getMomentsForDay(start, end);
    setDayMoments(rows);
  }, [dateKey]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  return {dayMoments, refreshDayMoments: refresh};
}
