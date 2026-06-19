import {getTodayDateKey} from '@/lib/day-utils';
import {persistTodaySealableSegments} from '@/lib/trip-materialization';
import {getCurrentTripDetectionConfig} from '@/lib/trip-detection-config';
import {notifyMaterializationUpdated} from '@/lib/trip-materialization-events';

export const TODAY_MAP_REFRESH_DEBOUNCE_MS = 3_000;
export const TODAY_MAP_REFRESH_MAX_WAIT_MS = 20_000;
export const TODAY_SEAL_DEBOUNCE_MS = 12_000;

let mapDebounceTimer: ReturnType<typeof setTimeout> | null = null;
let mapMaxWaitTimer: ReturnType<typeof setTimeout> | null = null;
let sealTimer: ReturnType<typeof setTimeout> | null = null;
let mapRefreshInFlight = false;
let sealInFlight = false;
let todayRefreshRevision = 0;

const todayHistoryRefreshListeners = new Set<() => void>();

export function getTodayHistoryRefreshRevision(): number {
  return todayRefreshRevision;
}

export function subscribeTodayHistoryRefresh(listener: () => void): () => void {
  todayHistoryRefreshListeners.add(listener);
  return () => todayHistoryRefreshListeners.delete(listener);
}

function notifyTodayHistoryRefresh(): void {
  todayRefreshRevision += 1;
  for (const listener of todayHistoryRefreshListeners) {
    listener();
  }
}

function clearMapRefreshTimers(): void {
  if (mapDebounceTimer != null) {
    clearTimeout(mapDebounceTimer);
    mapDebounceTimer = null;
  }
  if (mapMaxWaitTimer != null) {
    clearTimeout(mapMaxWaitTimer);
    mapMaxWaitTimer = null;
  }
}

/** GPS save — debounced map refresh + max-wait while driving; slower DB seal. */
export function scheduleTodayRefreshAfterGps(): void {
  scheduleMapRefreshDebounced();
  scheduleSealDebounced();
}

/** Foreground / motion-still — plot immediately. */
export function scheduleTodayImmediateMapRefresh(): void {
  clearMapRefreshTimers();
  void runTodayMapRefresh();
}

function scheduleMapRefreshDebounced(): void {
  if (mapDebounceTimer != null) {
    clearTimeout(mapDebounceTimer);
  }
  mapDebounceTimer = setTimeout(() => {
    mapDebounceTimer = null;
    clearMapRefreshTimers();
    void runTodayMapRefresh();
  }, TODAY_MAP_REFRESH_DEBOUNCE_MS);

  if (mapMaxWaitTimer == null) {
    mapMaxWaitTimer = setTimeout(() => {
      mapMaxWaitTimer = null;
      if (mapDebounceTimer != null) {
        clearTimeout(mapDebounceTimer);
        mapDebounceTimer = null;
      }
      void runTodayMapRefresh();
    }, TODAY_MAP_REFRESH_MAX_WAIT_MS);
  }
}

function scheduleSealDebounced(): void {
  if (sealTimer != null) {
    clearTimeout(sealTimer);
  }
  sealTimer = setTimeout(() => {
    sealTimer = null;
    void runTodaySealPersist();
  }, TODAY_SEAL_DEBOUNCE_MS);
}

async function runTodayMapRefresh(): Promise<void> {
  if (mapRefreshInFlight) {
    return;
  }
  mapRefreshInFlight = true;
  try {
    notifyTodayHistoryRefresh();
  } finally {
    mapRefreshInFlight = false;
  }
}

async function runTodaySealPersist(): Promise<void> {
  if (sealInFlight) {
    return;
  }
  sealInFlight = true;
  try {
    const dateKey = getTodayDateKey();
    const detectionConfig = getCurrentTripDetectionConfig();
    await persistTodaySealableSegments(dateKey, detectionConfig);
    notifyTodayHistoryRefresh();
    notifyMaterializationUpdated();
  } finally {
    sealInFlight = false;
  }
}

/** @internal — reset between tests. */
export function resetTodayRefreshSchedulerForTests(): void {
  clearMapRefreshTimers();
  if (sealTimer != null) {
    clearTimeout(sealTimer);
    sealTimer = null;
  }
  mapRefreshInFlight = false;
  sealInFlight = false;
  todayRefreshRevision = 0;
  todayHistoryRefreshListeners.clear();
}
