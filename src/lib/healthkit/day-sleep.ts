import { toDateKey } from '@/lib/day-utils';

import { coalesceSleepSessions } from './sleep-math';
import { computeLifeMapSleepScore } from './sleep-score';

/** HK CategoryValueSleepAnalysis */
export const SLEEP_VALUE_IN_BED = 0;
export const SLEEP_VALUE_ASLEEP_UNSPECIFIED = 1;
export const SLEEP_VALUE_AWAKE = 2;
export const SLEEP_VALUE_ASLEEP_CORE = 3;
export const SLEEP_VALUE_ASLEEP_DEEP = 4;
export const SLEEP_VALUE_ASLEEP_REM = 5;

const AWAKENING_OVER_5_MIN_MS = 5 * 60_000;

export type SleepSampleInput = {
  uuid: string;
  startAt: Date;
  endAt: Date;
  value: number;
};

export type DaySleepRollup = {
  dateKey: string;
  asleepMs: number;
  awakeMs: number;
  remMs: number;
  coreMs: number;
  deepMs: number;
  unspecifiedMs: number;
  awakeningsOver5Min: number;
  sleepStartAt: Date | null;
  sleepEndAt: Date | null;
  score: number | null;
};

function overlapMs(
  aStart: Date,
  aEnd: Date,
  bStart: Date,
  bEnd: Date,
): number {
  const start = Math.max(aStart.getTime(), bStart.getTime());
  const end = Math.min(aEnd.getTime(), bEnd.getTime());
  return Math.max(0, end - start);
}

/** Merge overlapping/adjacent awake intervals, then count NSF awakenings >5 min. */
export function countAwakeningsOver5Min(
  intervals: Array<{ startAt: Date; endAt: Date }>,
): number {
  if (intervals.length === 0) {
    return 0;
  }
  const sorted = [...intervals].sort(
    (a, b) => a.startAt.getTime() - b.startAt.getTime(),
  );
  const merged: Array<{ start: number; end: number }> = [];
  for (const interval of sorted) {
    const start = interval.startAt.getTime();
    const end = interval.endAt.getTime();
    if (end <= start) {
      continue;
    }
    const last = merged[merged.length - 1];
    if (last != null && start <= last.end) {
      last.end = Math.max(last.end, end);
      continue;
    }
    merged.push({ start, end });
  }
  return merged.filter(m => m.end - m.start > AWAKENING_OVER_5_MIN_MS).length;
}

/**
 * Build per wake-day rollups from raw HealthKit sleep samples.
 * Each coalesced asleep session is attributed to the calendar day of its end
 * (wake day), matching how Apple Health typically surfaces last night under today.
 */
export function buildDaySleepRollups(
  samples: SleepSampleInput[],
): DaySleepRollup[] {
  const usable = samples.filter(s => s.endAt.getTime() > s.startAt.getTime());
  const sessions = coalesceSleepSessions(usable);
  if (sessions.length === 0) {
    return [];
  }

  type Acc = {
    asleepMs: number;
    awakeMs: number;
    remMs: number;
    coreMs: number;
    deepMs: number;
    unspecifiedMs: number;
    awakeningsOver5Min: number;
    sleepStartAt: Date;
    sleepEndAt: Date;
  };

  const byDay = new Map<string, Acc>();

  for (const session of sessions) {
    const dateKey = toDateKey(session.endAt);
    const existing = byDay.get(dateKey);
    const nextStart = existing
      ? new Date(
          Math.min(existing.sleepStartAt.getTime(), session.startAt.getTime()),
        )
      : session.startAt;
    const nextEnd = existing
      ? new Date(Math.max(existing.sleepEndAt.getTime(), session.endAt.getTime()))
      : session.endAt;

    let remMs = 0;
    let coreMs = 0;
    let deepMs = 0;
    let unspecifiedMs = 0;
    let awakeMs = 0;
    const awakeIntervals: Array<{ startAt: Date; endAt: Date }> = [];

    for (const sample of usable) {
      const start = Math.max(
        session.startAt.getTime(),
        sample.startAt.getTime(),
      );
      const end = Math.min(session.endAt.getTime(), sample.endAt.getTime());
      const ms = Math.max(0, end - start);
      if (ms <= 0) {
        continue;
      }
      if (sample.value === SLEEP_VALUE_AWAKE) {
        awakeMs += ms;
        awakeIntervals.push({
          startAt: new Date(start),
          endAt: new Date(end),
        });
      } else if (sample.value === SLEEP_VALUE_ASLEEP_REM) {
        remMs += ms;
      } else if (sample.value === SLEEP_VALUE_ASLEEP_CORE) {
        coreMs += ms;
      } else if (sample.value === SLEEP_VALUE_ASLEEP_DEEP) {
        deepMs += ms;
      } else if (sample.value === SLEEP_VALUE_ASLEEP_UNSPECIFIED) {
        unspecifiedMs += ms;
      }
    }

    let asleepTotal = remMs + coreMs + deepMs + unspecifiedMs;
    if (asleepTotal <= 0) {
      // Older watches may only report asleepUnspecified / merged span.
      asleepTotal = Math.max(
        0,
        session.endAt.getTime() - session.startAt.getTime(),
      );
      unspecifiedMs = asleepTotal;
    }

    const awakeningsOver5Min = countAwakeningsOver5Min(awakeIntervals);

    if (existing) {
      byDay.set(dateKey, {
        asleepMs: existing.asleepMs + asleepTotal,
        awakeMs: existing.awakeMs + awakeMs,
        remMs: existing.remMs + remMs,
        coreMs: existing.coreMs + coreMs,
        deepMs: existing.deepMs + deepMs,
        unspecifiedMs: existing.unspecifiedMs + unspecifiedMs,
        awakeningsOver5Min: existing.awakeningsOver5Min + awakeningsOver5Min,
        sleepStartAt: nextStart,
        sleepEndAt: nextEnd,
      });
    } else {
      byDay.set(dateKey, {
        asleepMs: asleepTotal,
        awakeMs,
        remMs,
        coreMs,
        deepMs,
        unspecifiedMs,
        awakeningsOver5Min,
        sleepStartAt: nextStart,
        sleepEndAt: nextEnd,
      });
    }
  }

  const out: DaySleepRollup[] = [];
  for (const [dateKey, acc] of byDay) {
    const timeInBedMs = Math.max(
      acc.asleepMs + acc.awakeMs,
      acc.sleepEndAt.getTime() - acc.sleepStartAt.getTime(),
    );
    const score =
      acc.asleepMs > 0
        ? computeLifeMapSleepScore({
            asleepMs: acc.asleepMs,
            awakeMs: acc.awakeMs,
            awakeningsOver5Min: acc.awakeningsOver5Min,
            timeInBedMs,
            remMs: acc.remMs,
            coreMs: acc.coreMs,
            deepMs: acc.deepMs,
          }).total
        : null;
    out.push({
      dateKey,
      asleepMs: acc.asleepMs,
      awakeMs: acc.awakeMs,
      remMs: acc.remMs,
      coreMs: acc.coreMs,
      deepMs: acc.deepMs,
      unspecifiedMs: acc.unspecifiedMs,
      awakeningsOver5Min: acc.awakeningsOver5Min,
      sleepStartAt: acc.sleepStartAt,
      sleepEndAt: acc.sleepEndAt,
      score,
    });
  }
  return out.sort((a, b) => (a.dateKey < b.dateKey ? -1 : 1));
}
