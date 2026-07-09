/** iOS AVAudioRecorder averagePower is dBFS (~-160 silence, 0 max). */
export function normalizeVoiceMetering(db: number | undefined): number {
  if (db == null || !Number.isFinite(db)) {
    return 0.1;
  }
  const normalized = (db + 50) / 50;
  return Math.max(0.08, Math.min(1, normalized));
}

/** Lightweight fixed-shape bars for playback (no sample history needed). */
export function generateStaticWaveformBars(
  count: number,
  seed: number,
): number[] {
  let state = Math.max(1, Math.floor(seed)) ^ 0x9e3779b9;
  return Array.from({ length: count }, (_, index) => {
    state = (state * 1_664_525 + 1_013_904_223 + index) >>> 0;
    const wave = 0.55 + 0.45 * Math.sin(index * 0.65 + state * 0.00001);
    const noise = (state % 1000) / 1000;
    return Math.max(0.15, Math.min(1, wave * 0.7 + noise * 0.3));
  });
}

export function throttleVoiceUi<T extends (...args: never[]) => void>(
  fn: T,
  intervalMs: number,
): T {
  let lastAt = 0;
  let trailing: Parameters<T> | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const flush = () => {
    if (!trailing) {
      return;
    }
    const args = trailing;
    trailing = null;
    lastAt = Date.now();
    fn(...args);
  };

  return ((...args: Parameters<T>) => {
    const now = Date.now();
    trailing = args;
    if (now - lastAt >= intervalMs) {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      flush();
      return;
    }
    if (timer) {
      return;
    }
    timer = setTimeout(() => {
      timer = null;
      flush();
    }, intervalMs - (now - lastAt));
  }) as T;
}
