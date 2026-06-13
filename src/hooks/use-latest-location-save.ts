import {useEffect, useState} from 'react';
import {AppState} from 'react-native';

import {getLatestLocationPoint} from '@/db/repositories/location-points';
import {subscribeLocationPointInserts} from '@/db/repositories/location-points';

/** Live last-write time — used for tracking health UI (not full history reload). */
export function useLatestLocationSave(): Date | null {
  const [latestSaveAt, setLatestSaveAt] = useState<Date | null>(null);

  useEffect(() => {
    let cancelled = false;

    const refresh = async () => {
      const latest = await getLatestLocationPoint();
      if (!cancelled && latest?.timestamp) {
        setLatestSaveAt(latest.timestamp);
      }
    };

    void refresh();

    const unsubscribe = subscribeLocationPointInserts(point => {
      setLatestSaveAt(point.timestamp);
    });

    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') {
        void refresh();
      }
    });

    return () => {
      cancelled = true;
      unsubscribe();
      subscription.remove();
    };
  }, []);

  return latestSaveAt;
}
