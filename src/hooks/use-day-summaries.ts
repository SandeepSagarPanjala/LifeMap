import {useCallback, useMemo, useState} from 'react';
import {useFocusEffect} from '@react-navigation/native';

import {
  getDaySummaries,
  type DaySummary,
} from '@/db/repositories/location-days';

export function useDaySummaries(): {
  summaries: DaySummary[];
  dateKeysWithData: Set<string>;
  loading: boolean;
  refresh: () => void;
} {
  const [summaries, setSummaries] = useState<DaySummary[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(() => {
    setLoading(true);
    void getDaySummaries()
      .then(setSummaries)
      .finally(() => setLoading(false));
  }, []);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setLoading(true);
      void getDaySummaries()
        .then(result => {
          if (!cancelled) {
            setSummaries(result);
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

  const dateKeysWithData = useMemo(
    () => new Set(summaries.map(summary => summary.dateKey)),
    [summaries],
  );

  return {summaries, dateKeysWithData, loading, refresh};
}
