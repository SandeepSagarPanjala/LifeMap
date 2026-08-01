import { TZDate } from '@date-fns/tz';
import { format } from 'date-fns';

import { APP_TIMEZONE } from '@/lib/timezone';

import { isAsleepSleepValue } from './sleep-math';

export type TimelineSample = {
  startAt: Date;
  endAt: Date;
  value: number;
};

export type TimelineBlock = {
  startMs: number;
  endMs: number;
};

export type TimelineTick = {
  atMs: number;
  /** Null = draw the vertical rule only (skip crowded hour labels). */
  label: string | null;
};

export type SleepTimelineModel = {
  axisStartMs: number;
  axisEndMs: number;
  blocks: TimelineBlock[];
  ticks: TimelineTick[];
};

/** ~width of an "11AM" label as % of the plot — used to avoid overlaps. */
export const TIMELINE_MIN_LABEL_GAP_PCT = 13;

function startOfLocalHour(date: Date): Date {
  const local = new TZDate(date, APP_TIMEZONE);
  local.setMinutes(0, 0, 0);
  return new Date(local.getTime());
}

function formatAppleHourLabel(date: Date): string {
  return format(new TZDate(date, APP_TIMEZONE), 'ha')
    .replace(/\s/g, '')
    .toUpperCase();
}

/**
 * Always keep the first and last labels; fill the middle only when a candidate
 * sits far enough from every label already kept (no collisions).
 */
export function resolveTimelineLabels(
  ticks: TimelineTick[],
  axisStartMs: number,
  axisEndMs: number,
  minGapPct: number = TIMELINE_MIN_LABEL_GAP_PCT,
): TimelineTick[] {
  const candidateIdx: number[] = [];
  for (let i = 0; i < ticks.length; i += 1) {
    if (ticks[i]!.label != null) {
      candidateIdx.push(i);
    }
  }
  if (candidateIdx.length <= 2) {
    return ticks;
  }

  const pctOf = (index: number) =>
    timelineLeftPct(ticks[index]!.atMs, axisStartMs, axisEndMs);

  const firstIdx = candidateIdx[0]!;
  const lastIdx = candidateIdx[candidateIdx.length - 1]!;
  const keep = new Set<number>([firstIdx, lastIdx]);

  for (const index of candidateIdx) {
    if (index === firstIdx || index === lastIdx) {
      continue;
    }
    const pct = pctOf(index);
    let fits = true;
    for (const kept of keep) {
      if (Math.abs(pct - pctOf(kept)) < minGapPct) {
        fits = false;
        break;
      }
    }
    if (fits) {
      keep.add(index);
    }
  }

  return ticks.map((tick, index) => {
    if (tick.label == null || keep.has(index)) {
      return tick;
    }
    return { ...tick, label: null };
  });
}

/**
 * Apple Watch–style Time Asleep geometry:
 * - asleep blocks with gaps for awake
 * - a vertical rule on every whole hour
 * - first + last hour labels always; middle labels only when they don’t collide
 */
export function buildSleepTimelineModel(
  samples: TimelineSample[],
  windowStart: Date,
  windowEnd: Date,
): SleepTimelineModel {
  const windowStartMs = windowStart.getTime();
  const windowEndMs = windowEnd.getTime();
  if (windowEndMs <= windowStartMs) {
    return {
      axisStartMs: windowStartMs,
      axisEndMs: windowStartMs + 1,
      blocks: [],
      ticks: [],
    };
  }

  const axisStartMs = startOfLocalHour(windowStart).getTime();
  const axisEndMs = windowEndMs;
  const lastHourMs = startOfLocalHour(windowEnd).getTime();

  const asleepIntervals = samples
    .filter(
      sample =>
        isAsleepSleepValue(sample.value) &&
        sample.endAt.getTime() > sample.startAt.getTime(),
    )
    .map(sample => ({
      // Axis may pad to the hour before windowStart for labels; blocks stay in-window.
      start: Math.max(windowStartMs, sample.startAt.getTime()),
      end: Math.min(axisEndMs, sample.endAt.getTime()),
    }))
    .filter(interval => interval.end > interval.start)
    .sort((a, b) => a.start - b.start);

  const blocks: TimelineBlock[] = [];
  for (const interval of asleepIntervals) {
    const last = blocks[blocks.length - 1];
    if (last != null && interval.start <= last.endMs + 60_000) {
      last.endMs = Math.max(last.endMs, interval.end);
      continue;
    }
    blocks.push({
      startMs: interval.start,
      endMs: interval.end,
    });
  }

  const hourMs = 3600_000;
  const ticks: TimelineTick[] = [];

  // Tentatively label every hour; collision pass drops the crowded ones.
  for (let atMs = axisStartMs; atMs <= lastHourMs; atMs += hourMs) {
    ticks.push({
      atMs,
      label: formatAppleHourLabel(new Date(atMs)),
    });
  }

  // Unlabeled rule at the true end when wake is mid-hour.
  if (axisEndMs - lastHourMs > 90_000) {
    ticks.push({ atMs: axisEndMs, label: null });
  }

  return {
    axisStartMs,
    axisEndMs,
    blocks,
    ticks: resolveTimelineLabels(ticks, axisStartMs, axisEndMs),
  };
}

export function timelineLeftPct(
  atMs: number,
  axisStartMs: number,
  axisEndMs: number,
): number {
  const span = Math.max(1, axisEndMs - axisStartMs);
  return ((atMs - axisStartMs) / span) * 100;
}
