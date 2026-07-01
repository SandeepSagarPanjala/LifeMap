import {TZDate} from '@date-fns/tz';
import {format} from 'date-fns';

import type {DayTimelineEntry, DetectedTrip} from '@/lib/trip-detection';
import {formatDistance, type DistanceUnit} from '@/lib/location-geo';
import {APP_TIMEZONE} from '@/lib/timezone';

function formatAppTime(date: Date, pattern: string): string {
  return format(new TZDate(date, APP_TIMEZONE), pattern);
}

export function formatTripDuration(durationMs: number): string {
  const totalMinutes = Math.max(0, Math.round(durationMs / 60_000));
  if (totalMinutes < 1) {
    return '< 1 min';
  }

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours === 0) {
    return `${minutes} min`;
  }
  if (minutes === 0) {
    return `${hours} hr`;
  }
  return `${hours} hr ${minutes} min`;
}

/** Life360-style: "Here for 3 hr 49 min" */
export function formatHereForDuration(durationMs: number): string {
  const totalMinutes = Math.max(1, Math.round(durationMs / 60_000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours === 0) {
    return `Here for ${minutes} min`;
  }
  if (minutes === 0) {
    return `Here for ${hours} hr`;
  }
  return `Here for ${hours} hr ${minutes} min`;
}

export function isVisitOngoing(
  _endAt: Date,
  _now = new Date(),
  options?: {openThroughNow?: boolean},
): boolean {
  return options?.openThroughNow === true;
}

/** "Today", "Yesterday", or "Monday, Jun 9" */
export function formatVisitDateLine(startAt: Date, now = new Date()): string {
  const day = new TZDate(startAt, APP_TIMEZONE);
  const today = new TZDate(now, APP_TIMEZONE);
  const yesterday = new TZDate(now, APP_TIMEZONE);
  yesterday.setDate(yesterday.getDate() - 1);

  const dayKey = format(day, 'yyyy-MM-dd');
  if (dayKey === format(today, 'yyyy-MM-dd')) {
    return 'Today';
  }
  if (dayKey === format(yesterday, 'yyyy-MM-dd')) {
    return 'Yesterday';
  }
  return format(day, 'EEEE, MMM d');
}

/** "9:20 AM to 10:20 AM" */
export function formatVisitTimeRange(
  startAt: Date,
  endAt: Date,
  options?: {now?: Date},
): string {
  const start = formatAppTime(startAt, 'h:mm a');
  const end = formatAppTime(options?.now ?? endAt, 'h:mm a');
  return `${start} to ${end}`;
}

/** @deprecated Use formatVisitTimeRange + formatTripDuration */
export function formatVisitRange(
  startAt: Date,
  endAt: Date,
  durationMs: number,
  options?: {ongoing?: boolean; now?: Date},
): string {
  return `${formatVisitTimeRange(startAt, endAt, {now: options?.now})} (${formatTripDuration(durationMs)})`;
}

export type StayVisitLabel = {
  title: string;
  subtitle: string;
  statusLine?: string;
};

/** Floor to whole minutes so clock end time and duration stay in sync on open visits. */
function ongoingVisitDisplay(
  startAt: Date,
  now: Date,
): {displayEndAt: Date; displayDurationMs: number} {
  const elapsedMs = Math.max(0, now.getTime() - startAt.getTime());
  const elapsedMinutes = Math.floor(elapsedMs / 60_000);
  return {
    displayEndAt: new Date(startAt.getTime() + elapsedMinutes * 60_000),
    displayDurationMs: elapsedMinutes * 60_000,
  };
}

export type DriveVisitLabel = {
  title: string;
  subtitle: string;
  statusLine?: string;
};

export function formatDriveVisitLabel(
  startAt: Date,
  endAt: Date,
  durationMs: number,
  options?: {openThroughNow?: boolean; now?: Date},
): DriveVisitLabel {
  const now = options?.now ?? new Date();
  const ongoing = isVisitOngoing(endAt, now, {
    openThroughNow: options?.openThroughNow,
  });
  if (ongoing) {
    const {displayEndAt, displayDurationMs} = ongoingVisitDisplay(startAt, now);
    return {
      title: formatVisitTimeRange(startAt, displayEndAt),
      subtitle: formatTripDuration(displayDurationMs),
      statusLine: 'Driving',
    };
  }
  return {
    title: formatVisitTimeRange(startAt, endAt),
    subtitle: formatTripDuration(durationMs),
    statusLine: undefined,
  };
}

export function formatStayVisitLabel(
  startAt: Date,
  endAt: Date,
  durationMs: number,
  options?: {openThroughNow?: boolean; now?: Date},
): StayVisitLabel {
  const now = options?.now ?? new Date();
  const ongoing = isVisitOngoing(endAt, now, {
    openThroughNow: options?.openThroughNow,
  });
  if (ongoing) {
    const {displayEndAt, displayDurationMs} = ongoingVisitDisplay(startAt, now);
    return {
      title: formatVisitTimeRange(startAt, displayEndAt),
      subtitle: formatTripDuration(displayDurationMs),
      statusLine: 'Still here',
    };
  }
  return {
    title: formatVisitTimeRange(startAt, endAt),
    subtitle: formatTripDuration(durationMs),
    statusLine: undefined,
  };
}

export function formatTripTimeRange(startAt: Date, endAt: Date): string {
  const safeEnd = endAt.getTime() >= startAt.getTime() ? endAt : startAt;
  if (safeEnd.getTime() === startAt.getTime()) {
    return formatAppTime(startAt, 'h:mm a');
  }

  const startDay = formatAppTime(startAt, 'yyyy-MM-dd');
  const endDay = formatAppTime(safeEnd, 'yyyy-MM-dd');
  const startTime = formatAppTime(startAt, 'h:mm a');

  if (startDay !== endDay) {
    const endLabel = format(new TZDate(safeEnd, APP_TIMEZONE), 'MMM d, h:mm a');
    return `${startTime} – ${endLabel}`;
  }

  return `${startTime} – ${formatAppTime(safeEnd, 'h:mm a')}`;
}

export function formatTripClockTime(date: Date): string {
  return formatAppTime(date, 'h:mm a');
}

export function formatTimelineKindLabel(entry: DayTimelineEntry): string {
  if (entry.kind === 'gap') {
    return 'Gap';
  }
  if (entry.kind === 'stay') {
    return 'Visit';
  }
  return 'Drive';
}

export function formatTimelineTitle(
  entry: DayTimelineEntry,
  now = new Date(),
): string {
  if (entry.kind === 'stay') {
    return formatStayVisitLabel(
      entry.startAt,
      entry.endAt,
      entry.durationMs,
      {openThroughNow: entry.openThroughNow, now},
    ).title;
  }
  return formatTripTimeRange(entry.startAt, entry.endAt);
}

export function formatTimelineStats(
  entry: DayTimelineEntry,
  distanceUnit: DistanceUnit,
): string {
  if (entry.kind === 'gap') {
    return `No saved locations · ${formatTripDuration(entry.durationMs)}`;
  }

  if (entry.kind === 'stay') {
    if (entry.durationMs < 60_000 && entry.points.length <= 1) {
      return `Saved at ${formatAppTime(entry.startAt, 'h:mm a')}`;
    }
    return formatTripDuration(entry.durationMs);
  }

  const distance =
    entry.distanceKm > 0
      ? formatDistance(entry.distanceKm, distanceUnit)
      : '0 m';
  return `Drive · ${distance} · ${formatTripDuration(entry.durationMs)}`;
}

/** @deprecated */
export function formatTripStats(trip: DetectedTrip, distanceUnit: DistanceUnit): string {
  return formatTimelineStats(trip, distanceUnit);
}
