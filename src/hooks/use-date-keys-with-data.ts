import {useCallback, useMemo, useState} from 'react';
import {useFocusEffect} from '@react-navigation/native';

import {getDateKeysWithLocationData} from '@/db/repositories/location-days';

/** Calendar dots for Map — reads timestamps only (not full day summaries). */
export function useDateKeysWithData(): {
  dateKeysWithData: Set<string>;
  loading: boolean;
  refresh: () => void;
} {
  const [dateKeys, setDateKeys] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(() => {
    setLoading(true);
    void getDateKeysWithLocationData()
      .then(setDateKeys)
      .finally(() => setLoading(false));
  }, []);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setLoading(true);
      void getDateKeysWithLocationData()
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
      return () => {
        cancelled = true;
      };
    }, []),
  );

  const dateKeysWithData = useMemo(() => new Set(dateKeys), [dateKeys]);

  return {dateKeysWithData, loading, refresh};
}
