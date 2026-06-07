import {useEffect, useMemo, useState} from 'react';
import {endOfMonth, startOfMonth} from 'date-fns';
import {InteractionManager} from 'react-native';

import {getDateKeysWithLocationDataInRange} from '@/db/repositories/location-days';

/** Calendar dots for one visible month — not the whole database. */
export function useDateKeysForMonth(
  visibleMonth: Date,
  enabled: boolean,
): {dateKeysWithData: Set<string>; loading: boolean} {
  const [dateKeys, setDateKeys] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const monthStart = useMemo(() => startOfMonth(visibleMonth), [visibleMonth]);
  const monthEnd = useMemo(() => endOfMonth(visibleMonth), [visibleMonth]);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    const task = InteractionManager.runAfterInteractions(() => {
      void getDateKeysWithLocationDataInRange(monthStart, monthEnd)
        .then(result => {
          if (!cancelled) {
            setDateKeys(result);
          }
        })
        .finally(() => {
          if (!cancelled) {
            setLoading(false);
          }
        });
    });

    return () => {
      cancelled = true;
      task.cancel();
    };
  }, [enabled, monthEnd, monthStart]);

  const dateKeysWithData = useMemo(() => new Set(dateKeys), [dateKeys]);

  return {dateKeysWithData, loading};
}
