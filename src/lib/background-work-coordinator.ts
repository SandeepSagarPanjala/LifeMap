import { format, parseISO } from 'date-fns';

import { listPastDaysNeedingSeal } from '@/db/repositories/location-day-summaries';
import { getCurrentTripDetectionConfig } from '@/lib/trip-detection-config';
import {
  clearBackgroundWorkProgress,
  setBackgroundWorkProgress,
  showBackgroundWorkBanner,
} from '@/lib/background-work-events';
import { waitUntilBackgroundWorkResumed } from '@/lib/background-work-pause';
import {
  buildPlaceCacheWorkQueue,
  type PlaceCacheWorkItem,
} from '@/lib/place-cache-backlog';
import {
  delayBetweenPlaceCacheItems,
  runPlaceCacheWorkItem,
} from '@/lib/place-cache-work';
import { silentTripSealToday } from '@/lib/today-sync';
import {
  rebuildPastDayTrips,
  sealYesterdayIfNeeded,
} from '@/lib/trip-materialization';
import { clearHistoryDataCache } from '@/lib/history-data-cache';
import { refreshTodayOnForeground } from '@/lib/today-refresh-scheduler';
import { yieldToEventLoop } from '@/lib/run-when-idle';

let cyclePromise: Promise<void> | null = null;
let abortAfterCurrentItem = false;

export function requestBackgroundWorkAbort(): void {
  abortAfterCurrentItem = true;
}

export function isBackgroundWorkCycleRunning(): boolean {
  return cyclePromise != null;
}

function formatPastDayLabel(dateKey: string): string {
  try {
    return format(parseISO(`${dateKey}T12:00:00`), 'MMM d');
  } catch {
    return dateKey;
  }
}

function placeCacheMessage(
  item: PlaceCacheWorkItem,
  completed: number,
  total: number,
): string {
  if (item.kind === 'open_visit') {
    return 'Looking up this place…';
  }
  return `Looking up places (${completed + 1}/${total})…`;
}

async function runPastDaySealPhase(
  dateKeys: readonly string[],
): Promise<boolean> {
  if (dateKeys.length === 0) {
    return false;
  }

  const config = getCurrentTripDetectionConfig();
  showBackgroundWorkBanner({
    phase: 'past_day_seal',
    message: `Building trips for ${formatPastDayLabel(dateKeys[0]!)} (1/${dateKeys.length})…`,
    completed: 0,
    total: dateKeys.length,
  });

  for (let index = 0; index < dateKeys.length; index += 1) {
    await waitUntilBackgroundWorkResumed();
    if (abortAfterCurrentItem) {
      break;
    }

    const dateKey = dateKeys[index]!;
    setBackgroundWorkProgress({
      phase: 'past_day_seal',
      message: `Building trips for ${formatPastDayLabel(dateKey)} (${index + 1}/${dateKeys.length})…`,
      completed: index,
      total: dateKeys.length,
    });

    await rebuildPastDayTrips(dateKey, config);
    clearHistoryDataCache();
    await yieldToEventLoop();

    if (abortAfterCurrentItem) {
      break;
    }
  }

  await refreshTodayOnForeground();
  return true;
}

async function runPlaceCachePhase(queue: readonly PlaceCacheWorkItem[]): Promise<void> {
  if (queue.length === 0) {
    return;
  }

  let completed = 0;
  showBackgroundWorkBanner({
    phase: 'place_cache',
    message: placeCacheMessage(queue[0]!, completed, queue.length),
    completed,
    total: queue.length,
  });

  for (const item of queue) {
    await waitUntilBackgroundWorkResumed();
    if (abortAfterCurrentItem) {
      break;
    }

    setBackgroundWorkProgress({
      phase: 'place_cache',
      message: placeCacheMessage(item, completed, queue.length),
      completed,
      total: queue.length,
    });

    await runPlaceCacheWorkItem(item);
    completed += 1;

    setBackgroundWorkProgress({
      phase: 'place_cache',
      message:
        completed < queue.length
          ? placeCacheMessage(queue[completed]!, completed, queue.length)
          : `Looking up places (${completed}/${queue.length})…`,
      completed,
      total: queue.length,
    });

    if (abortAfterCurrentItem) {
      break;
    }

    await delayBetweenPlaceCacheItems();
  }

  await refreshTodayOnForeground();
}

async function runBackgroundWorkCycleImpl(): Promise<void> {
  abortAfterCurrentItem = false;
  const config = getCurrentTripDetectionConfig();

  setBackgroundWorkProgress({
    phase: 'today_seal',
    message: '',
    completed: 0,
    total: 0,
    bannerVisible: false,
  });

  await silentTripSealToday(config);
  await sealYesterdayIfNeeded();
  await yieldToEventLoop();

  // Past-day backlog comes from location_day_summaries (filled insert-once on
  // new GPS). No upgrade backfill — new installs grow the index naturally.
  const pastDays = await listPastDaysNeedingSeal();
  if (pastDays.length > 0) {
    await runPastDaySealPhase(pastDays);
    if (abortAfterCurrentItem) {
      clearBackgroundWorkProgress();
      return;
    }
  }

  const placeQueue = await buildPlaceCacheWorkQueue();
  if (placeQueue.length > 0) {
    await runPlaceCachePhase(placeQueue);
  }

  clearBackgroundWorkProgress();
}

/** Once per cold start or BG→FG after the map pipeline is ready. */
export function startBackgroundWorkCycle(): void {
  if (cyclePromise != null) {
    return;
  }

  cyclePromise = runBackgroundWorkCycleImpl()
    .catch(() => undefined)
    .finally(() => {
      cyclePromise = null;
      abortAfterCurrentItem = false;
    });
}

/** @internal — tests */
export function __resetBackgroundWorkCoordinatorForTests(): void {
  cyclePromise = null;
  abortAfterCurrentItem = false;
  clearBackgroundWorkProgress();
}
