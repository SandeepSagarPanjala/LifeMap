import { toDateKey } from '@/lib/day-utils';

import { coalesceSleepSessions } from './sleep-math';
import { computeLifeMapSleepScore } from './sleep-score';
import { SLEEP_MERGE_GAP_MS } from './types';

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

type StageKind = 'deep' | 'rem' | 'core' | 'awake' | 'unspecified';

/**
 * Higher wins when HealthKit samples overlap (Watch stages vs phone unspecified).
 * Explicit Awake beats staged sleep so brief wake samples aren’t swallowed by Core/REM.
 */
const STAGE_PRIORITY: Record<StageKind, number> = {
  awake: 6,
  deep: 5,
  rem: 4,
  core: 3,
  unspecified: 1,
};

function kindForValue(value: number): StageKind | null {
  if (value === SLEEP_VALUE_ASLEEP_DEEP) {
    return 'deep';
  }
  if (value === SLEEP_VALUE_ASLEEP_REM) {
    return 'rem';
  }
  if (value === SLEEP_VALUE_ASLEEP_CORE) {
    return 'core';
  }
  if (value === SLEEP_VALUE_AWAKE) {
    return 'awake';
  }
  if (value === SLEEP_VALUE_ASLEEP_UNSPECIFIED) {
    return 'unspecified';
  }
  return null;
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
 * Expand a sleep session window with overlapping / nearby In Bed + Awake samples
 * so awake before first stage / after last stage counts (closer to Apple Health).
 */
export function expandSleepWindow(
  sessionStart: Date,
  sessionEnd: Date,
  samples: SleepSampleInput[],
): { startAt: Date; endAt: Date } {
  let start = sessionStart.getTime();
  let end = sessionEnd.getTime();
  let changed = true;
  while (changed) {
    changed = false;
    for (const sample of samples) {
      if (
        sample.value !== SLEEP_VALUE_IN_BED &&
        sample.value !== SLEEP_VALUE_AWAKE
      ) {
        continue;
      }
      const s = sample.startAt.getTime();
      const e = sample.endAt.getTime();
      if (e <= s) {
        continue;
      }
      const near =
        e + SLEEP_MERGE_GAP_MS >= start && s - SLEEP_MERGE_GAP_MS <= end;
      if (!near) {
        continue;
      }
      if (s < start) {
        start = s;
        changed = true;
      }
      if (e > end) {
        end = e;
        changed = true;
      }
    }
  }
  return { startAt: new Date(start), endAt: new Date(end) };
}

/**
 * Assign each millisecond in [windowStart, windowEnd) to the highest-priority
 * overlapping sample so unspecified overnight blobs don't double-count stages.
 *
 * In Bed with no overlapping stage/awake sample counts as Awake (time to fall
 * asleep / gaps Apple Health includes in Awake).
 */
export function allocateSleepStagesInWindow(
  windowStart: Date,
  windowEnd: Date,
  samples: SleepSampleInput[],
): {
  awakeMs: number;
  remMs: number;
  coreMs: number;
  deepMs: number;
  unspecifiedMs: number;
  awakeIntervals: Array<{ startAt: Date; endAt: Date }>;
} {
  const w0 = windowStart.getTime();
  const w1 = windowEnd.getTime();
  const empty = {
    awakeMs: 0,
    remMs: 0,
    coreMs: 0,
    deepMs: 0,
    unspecifiedMs: 0,
    awakeIntervals: [] as Array<{ startAt: Date; endAt: Date }>,
  };
  if (w1 <= w0) {
    return empty;
  }

  const intervals: Array<{ start: number; end: number; kind: StageKind }> = [];
  const inBedIntervals: Array<{ start: number; end: number }> = [];
  for (const sample of samples) {
    const start = Math.max(w0, sample.startAt.getTime());
    const end = Math.min(w1, sample.endAt.getTime());
    if (end <= start) {
      continue;
    }
    if (sample.value === SLEEP_VALUE_IN_BED) {
      inBedIntervals.push({ start, end });
      continue;
    }
    const kind = kindForValue(sample.value);
    if (kind == null) {
      continue;
    }
    intervals.push({ start, end, kind });
  }
  if (intervals.length === 0 && inBedIntervals.length === 0) {
    return empty;
  }

  const points = new Set<number>([w0, w1]);
  for (const interval of intervals) {
    points.add(interval.start);
    points.add(interval.end);
  }
  for (const interval of inBedIntervals) {
    points.add(interval.start);
    points.add(interval.end);
  }
  const sorted = [...points].sort((a, b) => a - b);

  const totals = {
    awakeMs: 0,
    remMs: 0,
    coreMs: 0,
    deepMs: 0,
    unspecifiedMs: 0,
  };
  const awakeIntervals: Array<{ startAt: Date; endAt: Date }> = [];

  for (let i = 0; i < sorted.length - 1; i += 1) {
    const a = sorted[i]!;
    const b = sorted[i + 1]!;
    if (b <= a || a < w0 || b > w1) {
      continue;
    }
    const mid = (a + b) / 2;
    let best: StageKind | null = null;
    let bestPriority = 0;
    for (const interval of intervals) {
      if (interval.start <= mid && mid < interval.end) {
        const priority = STAGE_PRIORITY[interval.kind];
        if (priority > bestPriority) {
          bestPriority = priority;
          best = interval.kind;
        }
      }
    }
    if (best == null) {
      const inBed = inBedIntervals.some(
        interval => interval.start <= mid && mid < interval.end,
      );
      if (!inBed) {
        continue;
      }
      best = 'awake';
    }
    const ms = b - a;
    if (best === 'awake') {
      totals.awakeMs += ms;
      awakeIntervals.push({
        startAt: new Date(a),
        endAt: new Date(b),
      });
    } else if (best === 'rem') {
      totals.remMs += ms;
    } else if (best === 'core') {
      totals.coreMs += ms;
    } else if (best === 'deep') {
      totals.deepMs += ms;
    } else {
      totals.unspecifiedMs += ms;
    }
  }

  return { ...totals, awakeIntervals };
}

/**
 * Build per wake-day rollups from raw HealthKit sleep samples.
 * Each coalesced asleep session is attributed to the calendar day of its end
 * (wake day), matching how Apple Health typically surfaces last night under today.
 *
 * Allocation runs once per day over the union of that day’s sessions. Expanding
 * each session with a shared In Bed sample and summing separately double-counted
 * night + nap (inflating Time Asleep vs Apple Health).
 */
export function buildDaySleepRollups(
  samples: SleepSampleInput[],
): DaySleepRollup[] {
  const usable = samples.filter(s => s.endAt.getTime() > s.startAt.getTime());
  const sessions = coalesceSleepSessions(usable);
  if (sessions.length === 0) {
    return [];
  }

  const sessionsByDay = new Map<string, typeof sessions>();
  for (const session of sessions) {
    const dateKey = toDateKey(session.endAt);
    const list = sessionsByDay.get(dateKey);
    if (list) {
      list.push(session);
    } else {
      sessionsByDay.set(dateKey, [session]);
    }
  }

  const out: DaySleepRollup[] = [];
  for (const [dateKey, daySessions] of sessionsByDay) {
    let unionStart = daySessions[0]!.startAt.getTime();
    let unionEnd = daySessions[0]!.endAt.getTime();
    for (const session of daySessions) {
      unionStart = Math.min(unionStart, session.startAt.getTime());
      unionEnd = Math.max(unionEnd, session.endAt.getTime());
    }

    const window = expandSleepWindow(
      new Date(unionStart),
      new Date(unionEnd),
      usable,
    );
    const allocated = allocateSleepStagesInWindow(
      window.startAt,
      window.endAt,
      usable,
    );

    let remMs = allocated.remMs;
    let coreMs = allocated.coreMs;
    let deepMs = allocated.deepMs;
    let unspecifiedMs = allocated.unspecifiedMs;
    const awakeMs = allocated.awakeMs;
    let asleepTotal = remMs + coreMs + deepMs + unspecifiedMs;
    if (asleepTotal <= 0) {
      asleepTotal = Math.max(0, unionEnd - unionStart);
      unspecifiedMs = asleepTotal;
    }

    const awakeningsOver5Min = countAwakeningsOver5Min(
      allocated.awakeIntervals,
    );
    const timeInBedMs = Math.max(
      asleepTotal + awakeMs,
      window.endAt.getTime() - window.startAt.getTime(),
    );
    const score =
      asleepTotal > 0
        ? computeLifeMapSleepScore({
            asleepMs: asleepTotal,
            awakeMs,
            awakeningsOver5Min,
            timeInBedMs,
            remMs,
            coreMs,
            deepMs,
          }).total
        : null;

    out.push({
      dateKey,
      asleepMs: asleepTotal,
      awakeMs,
      remMs,
      coreMs,
      deepMs,
      unspecifiedMs,
      awakeningsOver5Min,
      sleepStartAt: window.startAt,
      sleepEndAt: window.endAt,
      score,
    });
  }
  return out.sort((a, b) => (a.dateKey < b.dateKey ? -1 : 1));
}
