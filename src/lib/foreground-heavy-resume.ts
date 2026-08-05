/**
 * Heavy BG→FG work after open grace / Map focus.
 * Order: drain → persist → seal yesterday → refresh today → background cycle.
 * Deferred when opening widget capture / capture-ish nav during open grace,
 * until Map focus (or next active safety net).
 */

import { notifyScheduledBackupOnForeground } from '@/lib/backup/scheduled-backup-foreground';
import { startBackgroundWorkCycle } from '@/lib/background-work-coordinator';
import {
  resetHeavyMapWorkOrbForTests,
  setHeavyResumeOrbActive,
} from '@/lib/heavy-map-work-orb';
import { getLocationService } from '@/location/transistorsoft-location-service';
import { yieldToEventLoop } from '@/lib/run-when-idle';
import { refreshTodayOnForeground } from '@/lib/today-refresh-scheduler';
import { sealYesterdayIfNeeded } from '@/lib/trip-materialization';

/** First seconds after open — let users jump to capture before heavy work. */
export const OPEN_GRACE_MS = 3_000;

let deferredHeavyResume = false;
let deferredNotifyBackup = false;
let suppressMapFocusFlushUntil = 0;
let heavyResumeInFlight: Promise<void> | null = null;

let openGraceActive = false;
let openGraceNotifyBackup = false;
let openGraceTimer: ReturnType<typeof setTimeout> | null = null;
let openGraceRevision = 0;
const openGraceListeners = new Set<() => void>();

let needsTodayRefreshOnMapFocus = false;

function bumpOpenGraceRevision(): void {
  openGraceRevision += 1;
  for (const listener of openGraceListeners) {
    listener();
  }
}

function clearOpenGraceTimer(): void {
  if (openGraceTimer != null) {
    clearTimeout(openGraceTimer);
    openGraceTimer = null;
  }
}

export function isOpenGraceActive(): boolean {
  return openGraceActive;
}

export function getOpenGraceRevision(): number {
  return openGraceRevision;
}

export function subscribeOpenGrace(listener: () => void): () => void {
  openGraceListeners.add(listener);
  return () => openGraceListeners.delete(listener);
}

/**
 * Start the post-open grace window. When it expires without defer/cancel,
 * `onExpire` runs (typically full heavy resume).
 */
export function startOpenGrace(options: {
  notifyBackup: boolean;
  onExpire: () => void;
}): void {
  clearOpenGraceTimer();
  openGraceActive = true;
  openGraceNotifyBackup = options.notifyBackup;
  bumpOpenGraceRevision();
  openGraceTimer = setTimeout(() => {
    openGraceTimer = null;
    if (!openGraceActive) {
      return;
    }
    openGraceActive = false;
    bumpOpenGraceRevision();
    options.onExpire();
  }, OPEN_GRACE_MS);
}

/** Cancel grace without running work (e.g. app backgrounded). */
export function cancelOpenGrace(): void {
  clearOpenGraceTimer();
  if (!openGraceActive) {
    return;
  }
  openGraceActive = false;
  bumpOpenGraceRevision();
}

/**
 * User opened You / Moments / Settings / etc. during grace → defer heavy work
 * until map focus (same as widget capture).
 * @returns true if grace was active and work was deferred
 */
export function deferHeavyWorkDuringOpenGrace(options?: {
  notifyBackup?: boolean;
}): boolean {
  if (!openGraceActive) {
    return false;
  }
  clearOpenGraceTimer();
  openGraceActive = false;
  bumpOpenGraceRevision();
  markHeavyForegroundResumeDeferred({
    notifyBackup: options?.notifyBackup ?? openGraceNotifyBackup,
  });
  return true;
}

/**
 * History / bullseye during grace → cancel wait and run full heavy resume now.
 */
export async function cancelOpenGraceAndRunHeavyResume(): Promise<boolean> {
  if (!openGraceActive && !deferredHeavyResume) {
    return false;
  }
  const notifyBackup = openGraceActive
    ? openGraceNotifyBackup
    : deferredNotifyBackup;
  clearOpenGraceTimer();
  openGraceActive = false;
  bumpOpenGraceRevision();
  deferredHeavyResume = false;
  deferredNotifyBackup = false;
  suppressMapFocusFlushUntil = 0;
  await runHeavyForegroundResume({ notifyBackup });
  return true;
}

export function markNeedsTodayRefreshOnMapFocus(): void {
  needsTodayRefreshOnMapFocus = true;
}

export function consumeNeedsTodayRefreshOnMapFocus(): boolean {
  if (!needsTodayRefreshOnMapFocus) {
    return false;
  }
  needsTodayRefreshOnMapFocus = false;
  return true;
}

export function hasNeedsTodayRefreshOnMapFocus(): boolean {
  return needsTodayRefreshOnMapFocus;
}

export function markHeavyForegroundResumeDeferred(options: {
  notifyBackup: boolean;
  suppressMapFocusMs?: number;
}): void {
  deferredHeavyResume = true;
  deferredNotifyBackup = options.notifyBackup;
  suppressMapFocusFlushUntil = Date.now() + (options.suppressMapFocusMs ?? 800);
}

export function hasHeavyForegroundResumeDeferred(): boolean {
  return deferredHeavyResume;
}

/** Allow safety-net flush on next active after user leaves mid-capture. */
export function clearHeavyResumeMapFocusSuppress(): void {
  suppressMapFocusFlushUntil = 0;
}

export async function runHeavyForegroundResume(options: {
  notifyBackup: boolean;
}): Promise<void> {
  if (heavyResumeInFlight != null) {
    await heavyResumeInFlight;
    return;
  }

  // Show orb before any await so the puck paints before CPU work.
  setHeavyResumeOrbActive(true);
  heavyResumeInFlight = (async () => {
    await yieldToEventLoop();

    const service = getLocationService();
    try {
      await service.drainNativeQueue();
    } catch {
      // Best-effort — persist pipeline may still have rows in SQLite.
    }
    try {
      await service.refreshPersistPipeline();
    } catch {
      // Best-effort — still refresh the map from whatever is in the DB.
    }

    try {
      await sealYesterdayIfNeeded();
    } catch {
      // Best-effort — still refresh today even if yesterday seal fails.
    }
    await refreshTodayOnForeground();
    startBackgroundWorkCycle();
    if (options.notifyBackup) {
      notifyScheduledBackupOnForeground();
    }
  })().finally(() => {
    heavyResumeInFlight = null;
    setHeavyResumeOrbActive(false);
  });

  await heavyResumeInFlight;
}

/**
 * Map focus / safety net: run deferred heavy resume once.
 * @param options.ignoreMapFocusSuppress — true for AppState active safety net
 */
export async function flushHeavyForegroundResumeIfDeferred(options?: {
  ignoreMapFocusSuppress?: boolean;
}): Promise<boolean> {
  if (!deferredHeavyResume) {
    return false;
  }
  if (
    !options?.ignoreMapFocusSuppress &&
    Date.now() < suppressMapFocusFlushUntil
  ) {
    return false;
  }

  const notifyBackup = deferredNotifyBackup;
  deferredHeavyResume = false;
  deferredNotifyBackup = false;
  suppressMapFocusFlushUntil = 0;

  await runHeavyForegroundResume({ notifyBackup });
  return true;
}

/** @internal — tests */
export function resetHeavyForegroundResumeForTests(): void {
  deferredHeavyResume = false;
  deferredNotifyBackup = false;
  suppressMapFocusFlushUntil = 0;
  heavyResumeInFlight = null;
  clearOpenGraceTimer();
  openGraceActive = false;
  openGraceNotifyBackup = false;
  openGraceRevision = 0;
  needsTodayRefreshOnMapFocus = false;
  resetHeavyMapWorkOrbForTests();
}
