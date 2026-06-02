/**
 * Fixed-window save scheduling: at most one DB row per window, keeping the
 * latest SDK location in that window (not the first).
 */
export type PersistFlushHandler = (payload: {
  timestampMs: number;
}) => void | Promise<void>;

export class LocationPersistScheduler {
  private lastPersistedMs: number | null = null;
  private pendingTimestampMs: number | null = null;
  private flushTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly maxIntervalMs: number,
    private readonly onFlush: PersistFlushHandler,
  ) {}

  reset(): void {
    this.clearTimer();
    this.lastPersistedMs = null;
    this.pendingTimestampMs = null;
  }

  /**
   * @returns true if this location was accepted into the scheduler (always when interval > 0)
   */
  enqueue(timestampMs: number): boolean {
    if (this.maxIntervalMs <= 0) {
      return false;
    }

    this.pendingTimestampMs = timestampMs;

    if (!this.flushTimer) {
      const delayMs = this.flushDelayMs(timestampMs);
      if (delayMs === 0) {
        void this.flushNow();
      } else {
        this.flushTimer = setTimeout(() => {
          this.flushTimer = null;
          void this.flushNow();
        }, delayMs);
      }
    }

    return true;
  }

  private flushDelayMs(timestampMs: number): number {
    if (this.lastPersistedMs == null) {
      return 0;
    }

    const elapsed = timestampMs - this.lastPersistedMs;
    if (elapsed >= this.maxIntervalMs) {
      return 0;
    }

    return this.maxIntervalMs - elapsed;
  }

  private async flushNow(): Promise<void> {
    this.clearTimer();

    const timestampMs = this.pendingTimestampMs;
    if (timestampMs == null) {
      return;
    }

    this.pendingTimestampMs = null;
    this.lastPersistedMs = timestampMs;

    await this.onFlush({timestampMs});
  }

  private clearTimer(): void {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
  }
}
