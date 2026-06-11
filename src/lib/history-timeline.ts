import {
  differenceInCalendarDays,
  endOfDay,
  format,
  isToday,
  isYesterday,
} from 'date-fns';

import {parseDateKey, getDayRange, shiftDateKey, toDateKey} from '@/lib/day-utils';
import type {DayTimelineEntry} from '@/lib/trip-detection';
import {isVisitOngoing} from '@/lib/trip-format';

const MIN_GAP_SEGMENT_PX = 2;

export const ANCHOR_SIZE_PX = 20;

/** @deprecated Use ANCHOR_SIZE_PX */
export const MIN_SEGMENT_TOUCH_PX = ANCHOR_SIZE_PX;

export const HISTORY_COLORS = {
  track: '#FFFFFF',
  trackEdge: '#E5E5EA',
  stay: '#FF9500',
  stayMuted: '#FFC56E',
  travel: '#007AFF',
  travelMuted: '#6EB0FF',
  gap: '#AEAEB2',
  gapMuted: '#D1D1D6',
  segmentSelectedBorder: '#FFFFFF',
  playhead: '#1C1C1E',
  anchor: '#FFFFFF',
  anchorBorder: '#1C1C1E',
  tickLabel: '#636366',
  tickMinor: '#C7C7CC',
  tickMajor: '#8E8E93',
  nowMarker: '#34C759',
} as const;

export function historySegmentColor(
  kind: DayTimelineEntry['kind'],
  selected = false,
): string {
  if (!selected) {
    if (kind === 'stay') {
      return HISTORY_COLORS.stayMuted;
    }
    if (kind === 'travel') {
      return HISTORY_COLORS.travelMuted;
    }
    return HISTORY_COLORS.gapMuted;
  }
  if (kind === 'stay') {
    return HISTORY_COLORS.stay;
  }
  if (kind === 'travel') {
    return HISTORY_COLORS.travel;
  }
  return HISTORY_COLORS.gap;
}

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
  hour: number;
  leftPx: number;
  label: string | null;
  kind: 'major' | 'minor';
};

export type HistoryDayRuler = {
  dateKey: string;
  dayStart: Date;
  label: string;
  segments: HistoryDaySegment[];
  ticks: HistoryRulerTick[];
  nowLeftPx: number | null;
  barWidthPx: number;
};

type TimeBreakpoint = {timeMs: number; px: number};

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

function minWidthForKind(kind: DayTimelineEntry['kind']): number {
  return kind === 'gap' ? MIN_GAP_SEGMENT_PX : ANCHOR_SIZE_PX;
}

function segmentDurationMs(segment: HistoryDaySegment): number {
  return Math.max(0, segment.endAt.getTime() - segment.startAt.getTime());
}

/**
 * Fixed-width bar: each visit/drive is at least scrub-handle wide; extra width
 * by duration. Clock gaps between events collapse (not drawn as empty track).
 */
export function layoutSegmentsOnFixedBar(
  segments: HistoryDaySegment[],
  barWidthPx: number,
): HistoryDaySegment[] {
  if (segments.length === 0) {
    return [];
  }

  const sorted = [...segments].sort(
    (a, b) => a.startAt.getTime() - b.startAt.getTime(),
  );

  const minSum = sorted.reduce(
    (sum, segment) => sum + minWidthForKind(segment.kind),
    0,
  );

  if (minSum >= barWidthPx) {
    const slot = barWidthPx / sorted.length;
    let left = 0;
    return sorted.map(segment => {
      const laid = {
        ...segment,
        leftPx: left,
        widthPx: slot,
      };
      left += slot;
      return laid;
    });
  }

  const flexWidth = barWidthPx - minSum;
  const playable = sorted.filter(segment => segment.kind !== 'gap');
  const totalDurationMs = playable.reduce(
    (sum, segment) => sum + segmentDurationMs(segment),
    0,
  );

  let left = 0;
  return sorted.map(segment => {
    const minW = minWidthForKind(segment.kind);
    let extra = 0;
    if (
      segment.kind !== 'gap' &&
      totalDurationMs > 0 &&
      flexWidth > 0
    ) {
      extra = (segmentDurationMs(segment) / totalDurationMs) * flexWidth;
    }
    const widthPx = minW + extra;
    const laid = {...segment, leftPx: left, widthPx};
    left += widthPx;
    return laid;
  });
}

function buildTimeBreakpoints(
  dayStart: Date,
  segments: HistoryDaySegment[],
  barWidthPx: number,
  now: Date,
): TimeBreakpoint[] {
  const dayEnd = endOfDay(dayStart);
  const endMs = Math.min(now.getTime(), dayEnd.getTime());
  const points: TimeBreakpoint[] = [{timeMs: dayStart.getTime(), px: 0}];

  const sorted = [...segments].sort(
    (a, b) => a.startAt.getTime() - b.startAt.getTime(),
  );

  for (const segment of sorted) {
    points.push({timeMs: segment.startAt.getTime(), px: segment.leftPx});
    points.push({
      timeMs: segment.endAt.getTime(),
      px: segment.leftPx + segment.widthPx,
    });
  }

  points.push({timeMs: endMs, px: barWidthPx});

  points.sort((a, b) => a.timeMs - b.timeMs);

  const deduped: TimeBreakpoint[] = [];
  for (const point of points) {
    const last = deduped[deduped.length - 1];
    if (last && last.timeMs === point.timeMs) {
      deduped[deduped.length - 1] = point;
    } else {
      deduped.push(point);
    }
  }

  return deduped;
}

export function timeToBarPx(
  time: Date,
  breakpoints: TimeBreakpoint[],
): number {
  const t = time.getTime();
  if (breakpoints.length === 0) {
    return 0;
  }
  if (t <= breakpoints[0]!.timeMs) {
    return breakpoints[0]!.px;
  }

  const last = breakpoints[breakpoints.length - 1]!;
  if (t >= last.timeMs) {
    return last.px;
  }

  for (let index = 0; index < breakpoints.length - 1; index += 1) {
    const a = breakpoints[index]!;
    const b = breakpoints[index + 1]!;
    if (t >= a.timeMs && t <= b.timeMs) {
      const span = b.timeMs - a.timeMs;
      if (span <= 0) {
        return b.px;
      }
      const ratio = (t - a.timeMs) / span;
      return a.px + ratio * (b.px - a.px);
    }
  }

  return last.px;
}

export function barPxToTime(
  px: number,
  breakpoints: TimeBreakpoint[],
): Date {
  if (breakpoints.length === 0) {
    return new Date();
  }

  const clampedPx = Math.max(
    breakpoints[0]!.px,
    Math.min(breakpoints[breakpoints.length - 1]!.px, px),
  );

  for (let index = 0; index < breakpoints.length - 1; index += 1) {
    const a = breakpoints[index]!;
    const b = breakpoints[index + 1]!;
    if (clampedPx >= a.px && clampedPx <= b.px) {
      const span = b.px - a.px;
      if (span <= 0) {
        return new Date(b.timeMs);
      }
      const ratio = (clampedPx - a.px) / span;
      return new Date(a.timeMs + ratio * (b.timeMs - a.timeMs));
    }
  }

  return new Date(breakpoints[breakpoints.length - 1]!.timeMs);
}

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

/** Visits + drives shown on the history bar (excludes gaps). */
export function countHistoryTimelineEvents(
  entries: DayTimelineEntry[],
): number {
  return entries.filter(
    entry => entry.kind === 'stay' || entry.kind === 'travel',
  ).length;
}

export function formatHistoryDayTitle(
  dateKey: string,
  referenceNow: Date = new Date(),
): string {
  return formatDayRulerLabel(parseDateKey(dateKey), referenceNow);
}

/** Date label for the history day navigator (always shows calendar date). */
export function formatHistoryDayNavLabel(
  dateKey: string,
  referenceNow: Date = new Date(),
): string {
  const day = parseDateKey(dateKey);
  if (isToday(day)) {
    return 'Today';
  }
  if (day.getFullYear() !== referenceNow.getFullYear()) {
    return format(day, 'MMM d, yyyy');
  }
  return format(day, 'EEE, MMM d');
}

/** Always names the calendar day shown on the map — the source of truth for map data. */
export function formatMapDateLabel(
  dateKey: string,
  todayKey: string,
  referenceNow: Date = new Date(),
): string {
  const day = parseDateKey(dateKey);
  const calendarDate =
    day.getFullYear() !== referenceNow.getFullYear()
      ? format(day, 'MMM d, yyyy')
      : format(day, 'MMM d');

  if (dateKey === todayKey) {
    return `Today · ${calendarDate}`;
  }

  const weekday = format(day, 'EEE');
  return day.getFullYear() !== referenceNow.getFullYear()
    ? `${weekday} · ${format(day, 'MMM d, yyyy')}`
    : `${weekday} · ${calendarDate}`;
}

/** Linear 12 AM → 12 AM (used in tests / helpers). */
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

export function buildRulerTicks(
  dayStart: Date,
  breakpoints: TimeBreakpoint[],
  barWidthPx: number,
): HistoryRulerTick[] {
  const majorLabels: Record<number, string> = {
    0: '12 AM',
    6: '6 AM',
    12: '12 PM',
    18: '6 PM',
    24: '12 AM',
  };
  const ticks: HistoryRulerTick[] = [];

  for (let hour = 0; hour <= 24; hour += 1) {
    const time = new Date(dayStart.getTime() + hour * 3_600_000);
    const isMajor = hour % 6 === 0;
    ticks.push({
      hour,
      leftPx: timeToBarPx(time, breakpoints),
      label: isMajor ? majorLabels[hour] ?? null : null,
      kind: isMajor ? 'major' : 'minor',
    });
  }

  const maxPx = barWidthPx;
  const clamped = ticks.map(tick => ({
    ...tick,
    leftPx: Math.min(maxPx, Math.max(0, tick.leftPx)),
  }));
  return dedupeMajorTickLabels(clamped, 40);
}

/** Hide major hour labels that collapse to the same px on compressed timelines. */
export function dedupeMajorTickLabels(
  ticks: HistoryRulerTick[],
  minGapPx: number,
): HistoryRulerTick[] {
  const majors = ticks.filter(tick => tick.label != null);
  const hideHours = new Set<number>();

  for (let i = 0; i < majors.length; i += 1) {
    for (let j = i + 1; j < majors.length; j += 1) {
      const a = majors[i]!;
      const b = majors[j]!;
      if (Math.abs(a.leftPx - b.leftPx) >= minGapPx) {
        continue;
      }
      if (a.hour === 0 || b.hour === 0) {
        hideHours.add(a.hour === 24 ? a.hour : b.hour === 24 ? b.hour : b.hour);
      } else {
        hideHours.add(b.hour);
      }
    }
  }

  return ticks.map(tick =>
    hideHours.has(tick.hour) ? {...tick, label: null} : tick,
  );
}

function clipEntryToDay(
  entry: DayTimelineEntry,
  entryIndex: number,
  dayStart: Date,
  dayEnd: Date,
  now: Date,
): Omit<HistoryDaySegment, 'leftPx' | 'widthPx'> | null {
  const rawEnd = segmentEndAt(entry, now);
  const segStart = new Date(
    Math.max(entry.startAt.getTime(), dayStart.getTime()),
  );
  const segEnd = new Date(Math.min(rawEnd.getTime(), dayEnd.getTime()));

  if (segEnd.getTime() <= segStart.getTime()) {
    return null;
  }

  return {
    entryIndex,
    kind: entry.kind,
    startAt: segStart,
    endAt: segEnd,
  };
}

function listCalendarDays(rangeStart: Date, rangeEnd: Date): Date[] {
  const days: Date[] = [];
  let dateKey = toDateKey(rangeStart);
  const lastKey = toDateKey(rangeEnd);

  while (dateKey <= lastKey) {
    days.push(parseDateKey(dateKey));
    dateKey = shiftDateKey(dateKey, 1);
  }

  return days;
}

export function buildHistoryDayRuler(
  entries: DayTimelineEntry[],
  dateKey: string,
  barWidthPx: number,
  now: Date = new Date(),
): HistoryDayRuler {
  const {start: dayStart, end: dayEnd} = getDayRange(dateKey);
  const raw: HistoryDaySegment[] = [];

  for (let index = 0; index < entries.length; index += 1) {
    const entry = entries[index]!;
    if (entry.endAt < dayStart || entry.startAt > dayEnd) {
      continue;
    }
    const clipped = clipEntryToDay(entry, index, dayStart, dayEnd, now);
    if (clipped) {
      raw.push({
        ...clipped,
        leftPx: 0,
        widthPx: 0,
      });
    }
  }

  const segments = layoutSegmentsOnFixedBar(raw, barWidthPx);
  const breakpoints = buildTimeBreakpoints(
    dayStart,
    segments,
    barWidthPx,
    now,
  );

  return {
    dateKey,
    dayStart,
    label: formatDayRulerLabel(dayStart, now),
    segments,
    ticks: buildRulerTicks(dayStart, breakpoints, barWidthPx),
    nowLeftPx: isToday(dayStart) ? timeToBarPx(now, breakpoints) : null,
    barWidthPx,
  };
}

export function buildHistoryDayRulers(
  entries: DayTimelineEntry[],
  range: HistoryTimeRange,
  barWidthPx: number,
  now: Date = new Date(),
): HistoryDayRuler[] {
  const days = listCalendarDays(range.startAt, now);

  return days.map(day =>
    buildHistoryDayRuler(entries, toDateKey(day), barWidthPx, now),
  );
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
): number {
  const segment = ruler.segments.find(s => s.entryIndex === entryIndex);
  if (segment) {
    return segment.leftPx + segment.widthPx / 2;
  }
  return ruler.barWidthPx / 2;
}

export function clampAnchorPx(px: number, barWidthPx: number): number {
  const half = ANCHOR_SIZE_PX / 2;
  return Math.max(half, Math.min(barWidthPx - half, px));
}

export function selectionAtAnchorPx(
  ruler: HistoryDayRuler,
  anchorPx: number,
  _entries: DayTimelineEntry[],
): number {
  const direct = findSegmentAtLocalPx(ruler, anchorPx);
  if (direct) {
    return direct.entryIndex;
  }
  if (ruler.segments.length === 0) {
    return -1;
  }
  let bestIndex = ruler.segments[0]!.entryIndex;
  let bestDist = Number.POSITIVE_INFINITY;
  for (const segment of ruler.segments) {
    const center = segment.leftPx + segment.widthPx / 2;
    const dist = Math.abs(anchorPx - center);
    if (dist < bestDist) {
      bestDist = dist;
      bestIndex = segment.entryIndex;
    }
  }
  return bestIndex;
}

/** @deprecated */
export function timestampAtDayOffsetPx(
  localPx: number,
  ruler: HistoryDayRuler,
): Date {
  const breakpoints = buildTimeBreakpoints(
    ruler.dayStart,
    ruler.segments,
    ruler.barWidthPx,
    new Date(),
  );
  return barPxToTime(localPx, breakpoints);
}
