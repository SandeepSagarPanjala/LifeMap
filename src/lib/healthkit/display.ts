import { TZDate } from '@date-fns/tz';
import { format } from 'date-fns';

import {
  getDaySteps,
  listSleepSessionsOverlapping,
} from '@/db/repositories/health';
import { getDayRange } from '@/lib/day-utils';
import { APP_TIMEZONE } from '@/lib/timezone';
import { formatTripDuration } from '@/lib/trip-format';

import {
  annotateStayWithSleep,
  type StaySleepAnnotation,
} from './sleep-math';
import {
  getHealthKitMasterEnabled,
  getHealthKitSleepEnabled,
  getHealthKitStepsEnabled,
} from './settings';
import { SLEEP_STAY_MIN_OVERLAP_MS } from './types';

function formatClock(date: Date): string {
  return format(new TZDate(date, APP_TIMEZONE), 'h:mm a');
}

export type VisitSleepDisplay = {
  timeLine: string;
  durationLine: string;
};

export function formatVisitSleepLines(
  annotations: StaySleepAnnotation[],
): VisitSleepDisplay[] {
  return annotations.slice(0, 2).map(a => ({
    timeLine: `Slept ${formatClock(a.startAt)} – ${formatClock(a.endAt)}`,
    durationLine: formatTripDuration(a.durationMs),
  }));
}

export async function loadVisitSleepDisplay(
  stayStart: Date,
  stayEnd: Date,
): Promise<VisitSleepDisplay[]> {
  if (!(await getHealthKitMasterEnabled())) {
    return [];
  }
  if (!(await getHealthKitSleepEnabled())) {
    return [];
  }
  const sessions = await listSleepSessionsOverlapping(stayStart, stayEnd);
  const annotations = annotateStayWithSleep(
    stayStart,
    stayEnd,
    sessions,
    SLEEP_STAY_MIN_OVERLAP_MS,
  );
  return formatVisitSleepLines(annotations);
}

export type DayHealthChipStatus = {
  masterOn: boolean;
  sleepEnabled: boolean;
  stepsEnabled: boolean;
  sleepMs: number | null;
  steps: number | null;
};

/** Compact sleep for map chips: `7h 25m`. */
export function formatCompactSleepDuration(durationMs: number): string {
  const totalMinutes = Math.max(0, Math.round(durationMs / 60_000));
  if (totalMinutes < 1) {
    return '<1m';
  }
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) {
    return `${minutes}m`;
  }
  if (minutes === 0) {
    return `${hours}h`;
  }
  return `${hours}h ${minutes}m`;
}

export function formatSleepChipLabel(sleepMs: number | null): string {
  if (sleepMs == null || sleepMs <= 0) {
    return 'No data';
  }
  return formatCompactSleepDuration(sleepMs);
}

export function formatStepsChipLabel(steps: number | null): string {
  if (steps == null || steps <= 0) {
    return 'No data';
  }
  return `${steps.toLocaleString()} steps`;
}

/**
 * Day-level Health chip status for the selected map date.
 * `sleepEnabled` / `stepsEnabled` are false when master is off or that toggle is off.
 * Values are null when enabled but nothing is imported for the day.
 */
export async function loadDayHealthChipStatus(
  dateKey: string,
): Promise<DayHealthChipStatus> {
  const masterOn = await getHealthKitMasterEnabled();
  if (!masterOn) {
    return {
      masterOn: false,
      sleepEnabled: false,
      stepsEnabled: false,
      sleepMs: null,
      steps: null,
    };
  }

  const [sleepOn, stepsOn] = await Promise.all([
    getHealthKitSleepEnabled(),
    getHealthKitStepsEnabled(),
  ]);

  let sleepMs: number | null = null;
  if (sleepOn) {
    const { start, end } = getDayRange(dateKey);
    const sessions = await listSleepSessionsOverlapping(start, end);
    let total = 0;
    for (const s of sessions) {
      const overlapStart = Math.max(s.startAt.getTime(), start.getTime());
      const overlapEnd = Math.min(s.endAt.getTime(), end.getTime());
      total += Math.max(0, overlapEnd - overlapStart);
    }
    sleepMs = total > 0 ? total : null;
  }

  const steps = stepsOn ? await getDaySteps(dateKey) : null;

  return {
    masterOn: true,
    sleepEnabled: sleepOn,
    stepsEnabled: stepsOn,
    sleepMs,
    steps,
  };
}

/** @deprecated Prefer loadDayHealthChipStatus for enabled flags + values. */
export async function loadDayHealthChips(dateKey: string): Promise<{
  sleepMs: number | null;
  steps: number | null;
}> {
  const status = await loadDayHealthChipStatus(dateKey);
  return { sleepMs: status.sleepMs, steps: status.steps };
}
