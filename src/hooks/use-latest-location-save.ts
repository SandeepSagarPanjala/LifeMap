import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { getLatestLocationPoint } from '@/db/repositories/location-points';

/** Last GPS save time for gap warnings — no per-save map rerenders. */
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

    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') {
        void refresh();
      }
    });

    return () => {
      cancelled = true;
      subscription.remove();
    };
  }, []);

  return latestSaveAt;
}
