import {useCallback, useEffect, useRef, useState} from 'react';

import {TRIP_PLAYBACK_DURATION_MS} from '@/lib/trip-playback';

export function useTripPlayback(onFinished?: () => void) {
  const [progress, setProgress] = useState<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const startRef = useRef<number | null>(null);

  const stop = useCallback(() => {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    startRef.current = null;
    setProgress(null);
  }, []);

  const start = useCallback(() => {
    stop();
    startRef.current = Date.now();
    setProgress(0);

    const tick = () => {
      const now = Date.now();
      const startedAt = startRef.current;
      if (startedAt == null) {
        return;
      }

      const elapsed = now - startedAt;
      const next = Math.min(1, elapsed / TRIP_PLAYBACK_DURATION_MS);
      setProgress(next);

      if (next >= 1) {
        stop();
        onFinished?.();
        return;
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
  }, [onFinished, stop]);

  useEffect(() => () => stop(), [stop]);

  return {
    progress,
    isPlaying: progress != null,
    start,
    stop,
  };
}
