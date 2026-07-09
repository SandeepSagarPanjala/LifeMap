import { useCallback, useEffect, useState } from 'react';

const MARKER_SNAPSHOT_TIMEOUT_MS = 2_000;

/** Avoid an endless map snapshot loop if marker layout never settles. */
export function useMarkerTracksViewChanges(signature: string) {
  const [tracksViewChanges, setTracksViewChanges] = useState(true);

  useEffect(() => {
    setTracksViewChanges(true);
    const timer = setTimeout(() => {
      setTracksViewChanges(false);
    }, MARKER_SNAPSHOT_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [signature]);

  const onLayout = useCallback(() => {
    setTracksViewChanges(false);
  }, []);

  return { tracksViewChanges, onLayout };
}
