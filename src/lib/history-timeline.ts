import {
  addDays,
  differenceInCalendarDays,
  endOfDay,
  format,
  isToday,
  isYesterday,
  startOfDay,
} from 'date-fns';

import {toDateKey} from '@/lib/day-utils';
import type {DayTimelineEntry} from '@/lib/trip-detection';
import {isVisitOngoing} from '@/lib/trip-format';

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const MIN_SEGMENT_PX = 2;

export const ANCHOR_SIZE_PX = 24;

export const HISTORY_COLORS = {
  track: '#FFFFFF',
  trackEdge: '#E5E5EA',
  stay: '#FF9500',
  travel: '#007AFF',
  gap: '#AEAEB2',
  playhead: '#1C1C1E',
  anchor: '#FFFFFF',
  anchorBorder: '#1C1C1E',
  tickLabel: '#636366',
  tickMinor: '#C7C7CC',
  tickMajor: '#8E8E93',
  nowMarker: '#34C759',
} as const;

export type HistoryTimeRange = {
  startAt: Date;
  endAt: Date;
};

export type HistoryDaySegment = {
  entryIndex: number;
  kind: DayTimelineEntry['kind'];
  startAt: Date;
  endAt: Date;
  leftPx: number;
  widthPx: number;
};

export type HistoryRulerTick = {
  /** Hour index on midnight→midnight scale (0 = 12 AM, 12 = 12 PM, 24 = 12 AM). */
  hour: number;
  leftPx: number;
  label: string | null;
  kind: 'major' | 'minor';
};

/** One calendar day on a fixed 12 AM → 12 AM ruler. */
export type HistoryDayRuler = {
  dateKey: string;
  dayStart: Date;
  label: string;
  segments: HistoryDaySegment[];
  ticks: HistoryRulerTick[];
  nowLeftPx: number | null;
};

export function formatDayRulerLabel(day: Date, referenceNow: Date): string {
  if (isToday(day)) {
    return 'Today';
  }
  if (isYesterday(day)) {
    return 'Yesterday';
  }
  if (differenceInCalendarDays(referenceNow, day) <= 7) {
    return format(day, 'EEEE');
  }
  return format(day, 'MMM d');
}

/**
 * Ruler runs 12 AM → 12 AM (calendar midnight to next midnight).
 * Left edge = start of day; right edge = end of day.
 */
export function calendarTimeToRulerPx(
  time: Date,
  dayStart: Date,
  barWidthPx: number,
): number {
  const msFromMidnight = time.getTime() - dayStart.getTime();
  const hoursFromMidnight = msFromMidnight / 3_600_000;
  const clampedHours = Math.min(24, Math.max(0, hoursFromMidnight));
  return (clampedHours / 24) * barWidthPx;
}

export function rulerPxToCalendarTime(
  px: number,
  dayStart: Date,
  barWidthPx: number,
): Date {
  const ratio = Math.min(1, Math.max(0, px / barWidthPx));
  const hoursFromMidnight = ratio * 24;
  return new Date(dayStart.getTime() + hoursFromMidnight * 3_600_000);
}

/** Major label every 6 h; minor tick every 1 h on 12 AM → 12 AM scale. */
export function buildRulerTicks(barWidthPx: number): HistoryRulerTick[] {
  const majorLabels: Record<number, string> = {
    0: '12 AM',
    6: '6 AM',
    12: '12 PM',
    18: '6 PM',
    24: '12 AM',
  };
  const ticks: HistoryRulerTick[] = [];

  for (let hour = 0; hour <= 24; hour += 1) {
    const isMajor = hour % 6 === 0;
    ticks.push({
      hour,
      leftPx: (hour / 24) * barWidthPx,
      label: isMajor ? majorLabels[hour] ?? null : null,
      kind: isMajor ? 'major' : 'minor',
    });
  }

  return ticks;
}

function segmentEndAt(entry: DayTimelineEntry, now: Date): Date {
  if (
    entry.kind === 'stay' &&
    isVisitOngoing(entry.endAt, now, {
      openThroughNow: entry.openThroughNow,
    })
  ) {
    return now;
  }
  return entry.endAt;
}

function clipEntryToDay(
  entry: DayTimelineEntry,
  entryIndex: number,
  dayStart: Date,
  dayEnd: Date,
  now: Date,
  barWidthPx: number,
): HistoryDaySegment | null {
  const rawEnd = segmentEndAt(entry, now);
  const segStart = new Date(
    Math.max(entry.startAt.getTime(), dayStart.getTime()),
  );
  const segEnd = new Date(Math.min(rawEnd.getTime(), dayEnd.getTime()));

  if (segEnd.getTime() <= segStart.getTime()) {
    return null;
  }

  const leftPx = calendarTimeToRulerPx(segStart, dayStart, barWidthPx);
  const rightPx = calendarTimeToRulerPx(segEnd, dayStart, barWidthPx);

  return {
    entryIndex,
    kind: entry.kind,
    startAt: segStart,
    endAt: segEnd,
    leftPx: Math.min(leftPx, rightPx),
    widthPx: Math.max(MIN_SEGMENT_PX, Math.abs(rightPx - leftPx)),
  };
}

function listCalendarDays(rangeStart: Date, rangeEnd: Date): Date[] {
  const days: Date[] = [];
  let cursor = startOfDay(rangeStart);
  const last = startOfDay(rangeEnd);

  while (cursor.getTime() <= last.getTime()) {
    days.push(cursor);
    cursor = addDays(cursor, 1);
  }

  return days;
}

export function buildHistoryDayRulers(
  entries: DayTimelineEntry[],
  range: HistoryTimeRange,
  barWidthPx: number,
  now: Date = new Date(),
): HistoryDayRuler[] {
  const days = listCalendarDays(range.startAt, now);

  return days.map(day => {
    const dayStart = startOfDay(day);
    const dayEnd = endOfDay(day);
    const segments: HistoryDaySegment[] = [];

    for (let index = 0; index < entries.length; index += 1) {
      const entry = entries[index]!;
      if (entry.endAt < dayStart || entry.startAt > dayEnd) {
        continue;
      }
      const clipped = clipEntryToDay(
        entry,
        index,
        dayStart,
        dayEnd,
        now,
        barWidthPx,
      );
      if (clipped) {
        segments.push(clipped);
      }
    }

    return {
      dateKey: toDateKey(day),
      dayStart,
      label: formatDayRulerLabel(day, now),
      segments,
      ticks: buildRulerTicks(barWidthPx),
      nowLeftPx: isToday(day)
        ? calendarTimeToRulerPx(now, dayStart, barWidthPx)
        : null,
    };
  });
}

export function findEntryIndexAtTime(
  entries: DayTimelineEntry[],
  time: Date,
): number {
  const t = time.getTime();
  let best = -1;
  let bestDist = Number.POSITIVE_INFINITY;

  for (let index = 0; index < entries.length; index += 1) {
    const entry = entries[index]!;
    const start = entry.startAt.getTime();
    const end = entry.endAt.getTime();

    if (t >= start && t <= end) {
      return index;
    }

    const dist = t < start ? start - t : t - end;
    if (dist < bestDist) {
      bestDist = dist;
      best = index;
    }
  }

  return best;
}

export function findSegmentAtLocalPx(
  ruler: HistoryDayRuler,
  localPx: number,
): HistoryDaySegment | null {
  for (const segment of ruler.segments) {
    if (
      localPx >= segment.leftPx &&
      localPx <= segment.leftPx + segment.widthPx
    ) {
      return segment;
    }
  }
  return null;
}

export function anchorPxForEntry(
  ruler: HistoryDayRuler,
  entryIndex: number,
  barWidthPx: number,
): number {
  const segment = ruler.segments.find(s => s.entryIndex === entryIndex);
  if (segment) {
    return segment.leftPx + segment.widthPx / 2;
  }
  return barWidthPx / 2;
}

export function clampAnchorPx(px: number, barWidthPx: number): number {
  const half = ANCHOR_SIZE_PX / 2;
  return Math.max(half, Math.min(barWidthPx - half, px));
}

export function selectionAtAnchorPx(
  ruler: HistoryDayRuler,
  anchorPx: number,
  _entries: DayTimelineEntry[],
  _barWidthPx: number,
): number {
  const direct = findSegmentAtLocalPx(ruler, anchorPx);
  if (direct) {
    return direct.entryIndex;
  }
  return -1;
}

/** @deprecated */
export function timestampAtDayOffsetPx(
  localPx: number,
  ruler: HistoryDayRuler,
  barWidthPx: number,
): Date {
  return rulerPxToCalendarTime(localPx, ruler.dayStart, barWidthPx);
}
