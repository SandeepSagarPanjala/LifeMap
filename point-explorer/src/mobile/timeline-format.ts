import { formatDuration, formatDistance } from '@lifemap/segmentation';
import { APP_TIMEZONE } from '@lifemap/constants';
import { APP_COPY } from '@lifemap/copy';

import type { DayTimelineEntry, DetectedTrip } from './types';

const timeFmt = new Intl.DateTimeFormat('en-US', {
  timeZone: APP_TIMEZONE,
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
});

export function formatMobileDayPillLabel(dateKey: string): string {
  const [year, month, day] = dateKey.split('-');
  const date = new Date(Number(year), Number(month) - 1, Number(day));
  const weekday = new Intl.DateTimeFormat('en-US', { weekday: 'short' }).format(
    date,
  );
  const monthDay = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
  }).format(date);
  return `${weekday} · ${monthDay}`;
}

/** Matches mobile `formatMapDateLabel` — e.g. "Today · Jul 2" or "Wed · Jul 1". */
export function formatMapDateLabel(
  dateKey: string,
  todayKey: string,
  referenceNow: Date = new Date(),
): string {
  const [year, month, day] = dateKey.split('-').map(Number);
  const date = new Date(year!, month! - 1, day!);
  const sameYear = date.getFullYear() === referenceNow.getFullYear();
  const monthDay = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    ...(sameYear ? {} : { year: 'numeric' }),
  }).format(date);

  if (dateKey === todayKey) {
    return `Today · ${monthDay}`;
  }

  const weekday = new Intl.DateTimeFormat('en-US', { weekday: 'short' }).format(
    date,
  );
  return `${weekday} · ${monthDay}`;
}

export function formatTripDuration(durationMs: number): string {
  return formatDuration(durationMs);
}

export function formatTripTimeRange(startAt: Date, endAt: Date): string {
  const start = timeFmt.format(startAt);
  const end = timeFmt.format(endAt);
  return `${start} – ${end}`;
}

export function formatTripClockTime(date: Date): string {
  return timeFmt.format(date);
}

export function formatVisitTimeRange(startAt: Date, endAt: Date): string {
  return `${timeFmt.format(startAt)} to ${timeFmt.format(endAt)}`;
}

export function formatStayVisitLabel(
  startAt: Date,
  endAt: Date,
  durationMs: number,
): { title: string; subtitle: string } {
  return {
    title: formatVisitTimeRange(startAt, endAt),
    subtitle: formatTripDuration(durationMs),
  };
}

export function formatTimelineTitle(entry: DayTimelineEntry): string {
  if (entry.kind === 'stay') {
    return formatStayVisitLabel(entry.startAt, entry.endAt, entry.durationMs)
      .title;
  }
  return formatVisitTimeRange(entry.startAt, entry.endAt);
}

export function formatTimelineStats(entry: DayTimelineEntry): string {
  if (entry.kind === 'gap') {
    return `No saved locations · ${formatTripDuration(entry.durationMs)}`;
  }
  if (entry.kind === 'stay') {
    return formatTripDuration(entry.durationMs);
  }
  const distance =
    entry.distanceKm > 0 ? formatDistance(entry.distanceKm * 1000) : '0 m';
  return `${
    APP_COPY.explorer.segmentDrive
  } · ${distance} · ${formatTripDuration(entry.durationMs)}`;
}

export function visitPlaceName(entry: DetectedTrip): string | null {
  return entry.placeLabel ?? null;
}

export function savedPlaceIcon(kind: DetectedTrip['savedPlaceKind']): string {
  if (kind === 'home') return '🏠';
  if (kind === 'work') return '💼';
  if (kind === 'favorite') return '⭐';
  return '';
}

export function driveEndpointLabel(label: string | undefined): string | null {
  return label?.trim() ? label : null;
}

export function driveStatsLine(entry: DetectedTrip): string {
  const stats = formatTimelineStats(entry);
  const prefix = `${APP_COPY.explorer.segmentDrive} · `;
  return stats.startsWith(prefix) ? stats.slice(prefix.length) : stats;
}
