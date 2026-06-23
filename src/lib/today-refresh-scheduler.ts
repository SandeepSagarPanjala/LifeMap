let todayRefreshRevision = 0;

const todayHistoryRefreshListeners = new Set<() => void>();

export function getTodayHistoryRefreshRevision(): number {
  return todayRefreshRevision;
}

export function subscribeTodayHistoryRefresh(listener: () => void): () => void {
  todayHistoryRefreshListeners.add(listener);
  return () => todayHistoryRefreshListeners.delete(listener);
}

/** Notify listeners — used when the app returns to the foreground. */
export function refreshTodayOnForeground(): void {
  todayRefreshRevision += 1;
  for (const listener of todayHistoryRefreshListeners) {
    listener();
  }
}

let gpsRefreshTimer: ReturnType<typeof setTimeout> | null = null;
const GPS_REFRESH_DEBOUNCE_MS = 8_000;

/** Debounced today sync after new GPS rows are saved. */
export function scheduleTodayRefreshAfterGps(): void {
  if (gpsRefreshTimer != null) {
    clearTimeout(gpsRefreshTimer);
  }
  gpsRefreshTimer = setTimeout(() => {
    gpsRefreshTimer = null;
    refreshTodayOnForeground();
  }, GPS_REFRESH_DEBOUNCE_MS);
}

/** @deprecated Use refreshTodayOnForeground */
export function scheduleTodayImmediateMapRefresh(): void {
  refreshTodayOnForeground();
}

/** @internal — reset between tests. */
export function resetTodayRefreshSchedulerForTests(): void {
  todayRefreshRevision = 0;
  todayHistoryRefreshListeners.clear();
  if (gpsRefreshTimer != null) {
    clearTimeout(gpsRefreshTimer);
    gpsRefreshTimer = null;
  }
}
