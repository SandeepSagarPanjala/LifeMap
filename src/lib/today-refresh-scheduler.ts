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

/** GPS saves do not trigger map/history rebuilds. */
export function scheduleTodayRefreshAfterGps(): void {}

/** @deprecated Use refreshTodayOnForeground */
export function scheduleTodayImmediateMapRefresh(): void {
  refreshTodayOnForeground();
}

/** @internal — reset between tests. */
export function resetTodayRefreshSchedulerForTests(): void {
  todayRefreshRevision = 0;
  todayHistoryRefreshListeners.clear();
}
