import {
  DEFAULT_DRIVE_MAP_REFRESH_INTERVAL_MS,
  getDriveMapRefreshIntervalMs,
  type DriveMapRefreshIntervalMs,
} from '@/lib/drive-map-refresh-settings';
import type {DetectedTrip} from '@/lib/trip-detection';

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

let driveRefreshInterval: ReturnType<typeof setInterval> | null = null;
let driveIntervalStartRevision = 0;
let appIsForeground = true;
let driveIntervalMs = DEFAULT_DRIVE_MAP_REFRESH_INTERVAL_MS;

function clearGpsRefreshTimer(): void {
  if (gpsRefreshTimer != null) {
    clearTimeout(gpsRefreshTimer);
    gpsRefreshTimer = null;
  }
}

function stopDriveInterval(): void {
  driveIntervalStartRevision += 1;
  if (driveRefreshInterval != null) {
    clearInterval(driveRefreshInterval);
    driveRefreshInterval = null;
  }
}

async function startDriveInterval(): Promise<void> {
  if (!appIsForeground || driveRefreshInterval != null) {
    return;
  }
  const startRevision = ++driveIntervalStartRevision;
  clearGpsRefreshTimer();
  driveIntervalMs = await getDriveMapRefreshIntervalMs();
  if (
    startRevision !== driveIntervalStartRevision ||
    !appIsForeground ||
    driveRefreshInterval != null
  ) {
    return;
  }
  driveRefreshInterval = setInterval(() => {
    refreshTodayOnForeground();
  }, driveIntervalMs);
}

function isOpenDriveActivity(activity: DetectedTrip | null): boolean {
  return activity?.kind === 'travel' && activity.openThroughNow === true;
}

/** Debounced today sync after new GPS rows are saved (stationary / background). */
export function scheduleTodayRefreshAfterGps(): void {
  if (driveRefreshInterval != null) {
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

/** Foreground drive mode — fixed interval; GPS saves do not retrigger debounce. */
export function updateTodayRefreshAfterSync(
  openActivity: DetectedTrip | null,
): void {
  if (appIsForeground && isOpenDriveActivity(openActivity)) {
    void startDriveInterval();
    return;
  }
  stopDriveInterval();
}

export function setTodayRefreshAppForeground(foreground: boolean): void {
  appIsForeground = foreground;
  if (!foreground) {
    stopDriveInterval();
  }
}

export function notifyDriveMapRefreshIntervalChanged(
  ms: DriveMapRefreshIntervalMs,
): void {
  driveIntervalMs = ms;
  if (driveRefreshInterval == null) {
    return;
  }
  stopDriveInterval();
  void startDriveInterval();
}

/** @deprecated Use refreshTodayOnForeground */
export function scheduleTodayImmediateMapRefresh(): void {
  refreshTodayOnForeground();
}

/** @internal — reset between tests. */
export function resetTodayRefreshSchedulerForTests(): void {
  todayRefreshRevision = 0;
  todayHistoryRefreshListeners.clear();
  driveIntervalStartRevision = 0;
  clearGpsRefreshTimer();
  if (driveRefreshInterval != null) {
    clearInterval(driveRefreshInterval);
    driveRefreshInterval = null;
  }
  appIsForeground = true;
  driveIntervalMs = DEFAULT_DRIVE_MAP_REFRESH_INTERVAL_MS;
}

/** @internal — test helpers */
export function isDriveRefreshIntervalActiveForTests(): boolean {
  return driveRefreshInterval != null;
}

export function getDriveRefreshIntervalMsForTests(): number {
  return driveIntervalMs;
}
