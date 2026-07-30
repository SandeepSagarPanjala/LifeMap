import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';

import {
  loadDayHealthChipStatus,
  type DayHealthChipStatus,
} from '@/lib/healthkit/display';
import { subscribeHealthData } from '@/lib/healthkit/events';

const EMPTY: DayHealthChipStatus = {
  masterOn: false,
  sleepEnabled: false,
  stepsEnabled: false,
  sleepMs: null,
  steps: null,
};

/**
 * Selected-day Health chip status for map floating controls.
 * Reloads on date change, map focus, and Health sync/settings updates.
 */
export function useDayHealthChips(dateKey: string): DayHealthChipStatus {
  const [status, setStatus] = useState<DayHealthChipStatus>(EMPTY);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const refresh = useCallback(async () => {
    const next = await loadDayHealthChipStatus(dateKey);
    if (!mountedRef.current) {
      return;
    }
    setStatus(current => {
      if (
        current.masterOn === next.masterOn &&
        current.sleepEnabled === next.sleepEnabled &&
        current.stepsEnabled === next.stepsEnabled &&
        current.sleepMs === next.sleepMs &&
        current.steps === next.steps
      ) {
        return current;
      }
      return next;
    });
  }, [dateKey]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(
    () =>
      subscribeHealthData(() => {
        void refresh();
      }),
    [refresh],
  );

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  return status;
}
