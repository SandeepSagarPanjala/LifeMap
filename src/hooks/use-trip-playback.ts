import {useCallback, useEffect, useRef, useState} from 'react';

import {TRIP_PLAYBACK_DURATION_MS} from '@/lib/trip-playback';

/** Limit React updates during route playback — native map still animates smoothly. */
const PLAYBACK_UI_INTERVAL_MS = 66;

export function useTripPlayback(onFinished?: () => void) {
  const [progress, setProgress] = useState<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const lastUiUpdateRef = useRef<number | null>(null);
  const durationMsRef = useRef(TRIP_PLAYBACK_DURATION_MS);
  const onFinishedRef = useRef(onFinished);
  onFinishedRef.current = onFinished;

  const stop = useCallback(() => {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    startTimeRef.current = null;
    lastUiUpdateRef.current = null;
    setProgress(null);
  }, []);

  const start = useCallback((durationMs: number = TRIP_PLAYBACK_DURATION_MS) => {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
    }
    durationMsRef.current = Math.max(8_000, durationMs);
    startTimeRef.current = null;
    lastUiUpdateRef.current = null;
    setProgress(0);

    const tick = (frameTime: number) => {
      if (startTimeRef.current == null) {
        startTimeRef.current = frameTime;
      }

      const elapsed = frameTime - startTimeRef.current;
      const next = Math.min(1, elapsed / durationMsRef.current);
      const shouldUpdateUi =
        lastUiUpdateRef.current == null ||
        frameTime - lastUiUpdateRef.current >= PLAYBACK_UI_INTERVAL_MS ||
        next >= 1;
      if (shouldUpdateUi) {
        lastUiUpdateRef.current = frameTime;
        setProgress(next);
      }

      if (next >= 1) {
        if (rafRef.current != null) {
          cancelAnimationFrame(rafRef.current);
          rafRef.current = null;
        }
        startTimeRef.current = null;
        setProgress(null);
        onFinishedRef.current?.();
        return;
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
  }, []);

  useEffect(() => () => stop(), [stop]);

  return {
    progress,
    isPlaying: progress != null,
    start,
    stop,
  };
}
