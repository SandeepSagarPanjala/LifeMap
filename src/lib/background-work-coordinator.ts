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
  buildPlaceCacheItemsForDate,
} from '@/lib/place-cache-backlog';
import {
  delayBetweenPlaceCacheItems,
  runPlaceCacheWorkItem,
} from '@/lib/place-cache-work';
import { rebuildPastDayTrips } from '@/lib/trip-materialization';
import { clearHistoryDataCache } from '@/lib/history-data-cache';
import { setBackgroundCycleOrbActive } from '@/lib/heavy-map-work-orb';
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

async function runPlaceCachePhaseForDay(
  dateKey: string,
  dayLabel: string,
): Promise<void> {
  const items = await buildPlaceCacheItemsForDate(dateKey);
  if (items.length === 0) {
    return;
  }

  let completed = 0;
  showBackgroundWorkBanner({
    phase: 'place_cache',
    message: `Looking up places for ${dayLabel} (1/${items.length})…`,
    completed,
    total: items.length,
  });

  for (const item of items) {
    await waitUntilBackgroundWorkResumed();
    if (abortAfterCurrentItem) {
      break;
    }

    setBackgroundWorkProgress({
      phase: 'place_cache',
      message: `Looking up places for ${dayLabel} (${completed + 1}/${
        items.length
      })…`,
      completed,
      total: items.length,
    });

    await runPlaceCacheWorkItem(item);
    completed += 1;

    setBackgroundWorkProgress({
      phase: 'place_cache',
      message: `Looking up places for ${dayLabel} (${completed}/${items.length})…`,
      completed,
      total: items.length,
    });

    if (abortAfterCurrentItem) {
      break;
    }

    await delayBetweenPlaceCacheItems();
  }
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
    message: `Building trips for ${formatPastDayLabel(dateKeys[0]!)} (1/${
      dateKeys.length
    })…`,
    completed: 0,
    total: dateKeys.length,
  });

  for (let index = 0; index < dateKeys.length; index += 1) {
    await waitUntilBackgroundWorkResumed();
    if (abortAfterCurrentItem) {
      break;
    }

    const dateKey = dateKeys[index]!;
    const dayLabel = formatPastDayLabel(dateKey);
    setBackgroundWorkProgress({
      phase: 'past_day_seal',
      message: `Building trips for ${dayLabel} (${index + 1}/${
        dateKeys.length
      })…`,
      completed: index,
      total: dateKeys.length,
    });

    await rebuildPastDayTrips(dateKey, config);
    clearHistoryDataCache();
    await yieldToEventLoop();

    if (abortAfterCurrentItem) {
      break;
    }

    await runPlaceCachePhaseForDay(dateKey, dayLabel);

    if (abortAfterCurrentItem) {
      break;
    }
  }

  await refreshTodayOnForeground();
  return true;
}

async function runBackgroundWorkCycleImpl(): Promise<void> {
  abortAfterCurrentItem = false;

  // Today seal + places run after syncTodayDisplay (once per open).
  // Yesterday seal + places run in sealYesterdayIfNeeded.
  // Past-day backlog: seal each day, then places for that day's unlabeled stays.
  const pastDays = await listPastDaysNeedingSeal();
  if (pastDays.length > 0) {
    await runPastDaySealPhase(pastDays);
  }

  clearBackgroundWorkProgress();
}

/** Once per cold start or BG→FG after the map pipeline is ready. */
export function startBackgroundWorkCycle(): void {
  if (cyclePromise != null) {
    return;
  }

  setBackgroundCycleOrbActive(true);
  cyclePromise = runBackgroundWorkCycleImpl()
    .catch(() => undefined)
    .finally(() => {
      cyclePromise = null;
      abortAfterCurrentItem = false;
      setBackgroundCycleOrbActive(false);
    });
}

/** @internal — tests */
export function __resetBackgroundWorkCoordinatorForTests(): void {
  cyclePromise = null;
  abortAfterCurrentItem = false;
  clearBackgroundWorkProgress();
  setBackgroundCycleOrbActive(false);
}
