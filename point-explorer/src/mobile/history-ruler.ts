import {
  chicagoDayEnd,
  chicagoDayStart,
  dateKeyForTimestamp,
  formatDateLabel,
} from '../lib/export';
import type { DayTimelineEntry } from './types';

export const HISTORY_COLORS = {
  track: '#FFFFFF',
  trackEdge: '#E5E5EA',
  stay: '#FF9500',
  stayMuted: '#FFC56E',
  travel: '#007AFF',
  travelMuted: '#6EB0FF',
  gap: '#AEAEB2',
  gapMuted: '#D1D1D6',
  playhead: '#1C1C1E',
  tickLabel: '#636366',
  tickMinor: '#C7C7CC',
  tickMajor: '#8E8E93',
  nowMarker: '#34C759',
} as const;

export const ANCHOR_SIZE_PX = 20;
const MIN_GAP_SEGMENT_PX = 2;

export function historySegmentColor(
  kind: DayTimelineEntry['kind'],
  selected = false,
): string {
  if (!selected) {
    if (kind === 'stay') return HISTORY_COLORS.stayMuted;
    if (kind === 'travel') return HISTORY_COLORS.travelMuted;
    return HISTORY_COLORS.gapMuted;
  }
  if (kind === 'stay') return HISTORY_COLORS.stay;
  if (kind === 'travel') return HISTORY_COLORS.travel;
  return HISTORY_COLORS.gap;
}

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

type TimeBreakpoint = { timeMs: number; px: number };

function minWidthForKind(kind: DayTimelineEntry['kind']): number {
  return kind === 'gap' ? MIN_GAP_SEGMENT_PX : ANCHOR_SIZE_PX;
}

function segmentDurationMs(segment: HistoryDaySegment): number {
  return Math.max(0, segment.endAt.getTime() - segment.startAt.getTime());
}

function layoutSegmentsOnFixedBar(
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
      const laid = { ...segment, leftPx: left, widthPx: slot };
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
    if (segment.kind !== 'gap' && totalDurationMs > 0 && flexWidth > 0) {
      extra = (segmentDurationMs(segment) / totalDurationMs) * flexWidth;
    }
    const widthPx = minW + extra;
    const laid = { ...segment, leftPx: left, widthPx };
    left += widthPx;
    return laid;
  });
}

function buildTimeBreakpoints(
  dayStart: Date,
  dayEnd: Date,
  segments: HistoryDaySegment[],
  barWidthPx: number,
  now: Date,
): TimeBreakpoint[] {
  const endMs = Math.min(now.getTime(), dayEnd.getTime());
  const points: TimeBreakpoint[] = [{ timeMs: dayStart.getTime(), px: 0 }];

  const sorted = [...segments].sort(
    (a, b) => a.startAt.getTime() - b.startAt.getTime(),
  );

  for (const segment of sorted) {
    points.push({ timeMs: segment.startAt.getTime(), px: segment.leftPx });
    points.push({
      timeMs: segment.endAt.getTime(),
      px: segment.leftPx + segment.widthPx,
    });
  }

  points.push({ timeMs: endMs, px: barWidthPx });
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

function timeToBarPx(time: Date, breakpoints: TimeBreakpoint[]): number {
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
      return a.px + ((t - a.timeMs) / span) * (b.px - a.px);
    }
  }
  return last.px;
}

function buildRulerTicks(
  dayStart: Date,
  dayEnd: Date,
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
  const dayMs = dayEnd.getTime() - dayStart.getTime();

  for (let hour = 0; hour <= 24; hour += 1) {
    const time = new Date(dayStart.getTime() + (hour / 24) * dayMs);
    const isMajor = hour % 6 === 0;
    ticks.push({
      hour,
      leftPx: timeToBarPx(time, breakpoints),
      label: isMajor ? majorLabels[hour] ?? null : null,
      kind: isMajor ? 'major' : 'minor',
    });
  }

  return ticks.map(tick => ({
    ...tick,
    leftPx: Math.min(barWidthPx, Math.max(0, tick.leftPx)),
  }));
}

function clipEntryToDay(
  entry: DayTimelineEntry,
  entryIndex: number,
  dayStart: Date,
  dayEnd: Date,
): Omit<HistoryDaySegment, 'leftPx' | 'widthPx'> | null {
  const rawEnd = entry.endAt;
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

export function formatHistoryDayNavLabel(
  dateKey: string,
  todayKey: string,
): string {
  if (dateKey === todayKey) {
    return 'Today';
  }
  return formatDateLabel(dateKey);
}

export function buildHistoryDayRuler(
  entries: readonly DayTimelineEntry[],
  dateKey: string,
  barWidthPx: number,
  now: Date = new Date(),
): HistoryDayRuler {
  const dayStart = chicagoDayStart(dateKey);
  const dayEnd = chicagoDayEnd(dateKey);
  const todayKey = dateKeyForTimestamp(now.toISOString());
  const raw: HistoryDaySegment[] = [];

  for (let index = 0; index < entries.length; index += 1) {
    const entry = entries[index]!;
    if (entry.endAt < dayStart || entry.startAt > dayEnd) {
      continue;
    }
    const clipped = clipEntryToDay(entry, index, dayStart, dayEnd);
    if (clipped) {
      raw.push({ ...clipped, leftPx: 0, widthPx: 0 });
    }
  }

  const segments = layoutSegmentsOnFixedBar(raw, barWidthPx);
  const breakpoints = buildTimeBreakpoints(
    dayStart,
    dayEnd,
    segments,
    barWidthPx,
    now,
  );

  return {
    dateKey,
    dayStart,
    label: formatHistoryDayNavLabel(dateKey, todayKey),
    segments,
    ticks: buildRulerTicks(dayStart, dayEnd, breakpoints, barWidthPx),
    nowLeftPx: dateKey === todayKey ? timeToBarPx(now, breakpoints) : null,
    barWidthPx,
  };
}

export function countHistoryTimelineEvents(
  entries: readonly DayTimelineEntry[],
): number {
  return entries.filter(
    entry => entry.kind === 'stay' || entry.kind === 'travel',
  ).length;
}
