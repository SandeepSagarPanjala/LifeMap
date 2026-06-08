import {useEffect, useRef} from 'react';
import {AppState} from 'react-native';

import {getTodayDateKey} from '@/lib/day-utils';
import {runWhenIdle} from '@/lib/run-when-idle';
import {
  drainMaterializationQueue,
  enqueueSealForPreviousDayIfNeeded,
  scheduleTripMaterializationWorker,
} from '@/lib/trip-materialization';

/** Background trip persistence — date rollover seal + idle queue drain. */
export function useTripMaterializationBootstrap(): void {
  const lastDateKeyRef = useRef(getTodayDateKey());

  useEffect(() => {
    runWhenIdle(() => {
      void drainMaterializationQueue();
    });
  }, []);

  useEffect(() => {
    const checkDateRollover = () => {
      const today = getTodayDateKey();
      if (today === lastDateKeyRef.current) {
        return;
      }
      void enqueueSealForPreviousDayIfNeeded(lastDateKeyRef.current);
      lastDateKeyRef.current = today;
      scheduleTripMaterializationWorker();
    };

    checkDateRollover();
    const interval = setInterval(checkDateRollover, 60_000);

    const subscription = AppState.addEventListener('change', nextState => {
      if (nextState === 'active') {
        checkDateRollover();
        scheduleTripMaterializationWorker();
      }
    });

    return () => {
      clearInterval(interval);
      subscription.remove();
    };
  }, []);
}
