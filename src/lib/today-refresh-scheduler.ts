import type { DetectedTrip } from '@/lib/trip-detection';

let todayRefreshRevision = 0;

export type TodayHistoryRefreshListener = () => void | Promise<void>;

const todayHistoryRefreshListeners = new Set<TodayHistoryRefreshListener>();

export function getTodayHistoryRefreshRevision(): number {
  return todayRefreshRevision;
}

export function subscribeTodayHistoryRefresh(
  listener: TodayHistoryRefreshListener,
): () => void {
  todayHistoryRefreshListeners.add(listener);
  return () => todayHistoryRefreshListeners.delete(listener);
}

/** Notify map listeners to reload today — only while the app is foreground. */
export async function refreshTodayOnForeground(): Promise<void> {
  if (!appIsForeground) {
    return;
  }
  todayRefreshRevision += 1;
  const listenerResults = [...todayHistoryRefreshListeners].map(listener =>
    listener(),
  );
  await Promise.allSettled(
    listenerResults.map(result => Promise.resolve(result)),
  );
}

let gpsRefreshTimer: ReturnType<typeof setTimeout> | null = null;
const GPS_REFRESH_DEBOUNCE_MS = 8_000;

let appIsForeground = true;
/** Open drive — path grows in the background; map refreshes on foreground only. */
let openDriveActive = false;

function clearGpsRefreshTimer(): void {
  if (gpsRefreshTimer != null) {
    clearTimeout(gpsRefreshTimer);
    gpsRefreshTimer = null;
  }
}

function isOpenDriveActivity(activity: DetectedTrip | null): boolean {
  return activity?.kind === 'travel' && activity.openThroughNow === true;
}

/**
 * Debounced today sync after new GPS rows are saved (foreground stay mode only).
 * While driving, skip — the drive path refreshes when the app returns to foreground.
 */
export function scheduleTodayRefreshAfterGps(): void {
  if (!appIsForeground || openDriveActive) {
    return;
  }
  if (gpsRefreshTimer != null) {
    clearTimeout(gpsRefreshTimer);
  }
  gpsRefreshTimer = setTimeout(() => {
    gpsRefreshTimer = null;
    refreshTodayOnForeground();
  }, GPS_REFRESH_DEBOUNCE_MS);
}

/**
 * After today sync: while an open drive is active, suppress GPS debounce so the
 * polyline only updates on background → foreground (see AppBootstrap).
 */
export function updateTodayRefreshAfterSync(
  openActivity: DetectedTrip | null,
): void {
  const nextOpenDrive = isOpenDriveActivity(openActivity);
  openDriveActive = nextOpenDrive;
  if (nextOpenDrive) {
    clearGpsRefreshTimer();
  }
}

export function setTodayRefreshAppForeground(foreground: boolean): void {
  appIsForeground = foreground;
  if (!foreground) {
    clearGpsRefreshTimer();
  }
}

/** @deprecated Use refreshTodayOnForeground */
export function scheduleTodayImmediateMapRefresh(): void {
  refreshTodayOnForeground();
}

/** @internal — reset between tests. */
export function resetTodayRefreshSchedulerForTests(): void {
  todayRefreshRevision = 0;
  todayHistoryRefreshListeners.clear();
  clearGpsRefreshTimer();
  appIsForeground = true;
  openDriveActive = false;
}

/** @internal — test helpers */
export function isOpenDriveRefreshSuppressedForTests(): boolean {
  return openDriveActive;
}

export function isGpsRefreshTimerActiveForTests(): boolean {
  return gpsRefreshTimer != null;
}
