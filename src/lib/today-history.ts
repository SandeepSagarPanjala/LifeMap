import {differenceInMilliseconds, endOfDay, subHours} from 'date-fns';

import type {LocationPointRow} from '@/db/repositories/location-days';
import {getDayRange, toDateKey} from '@/lib/day-utils';
import {
  arePointsSamePlace,
  buildDayTimeline,
  dedupeLocationPoints,
  type DayTimelineEntry,
  type DetectedTrip,
} from '@/lib/trip-detection';
import type {TripDetectionConfig} from '@/lib/trip-settings';

const LOOKBACK_HOURS = 48;

function lastPointBefore(
  points: LocationPointRow[],
  dayStart: Date,
): LocationPointRow | null {
  let last: LocationPointRow | null = null;
  for (const point of points) {
    if (point.timestamp.getTime() < dayStart.getTime()) {
      last = point;
    }
  }
  return last;
}

function lastStayIndex(entries: DayTimelineEntry[]): number {
  for (let index = entries.length - 1; index >= 0; index -= 1) {
    if (entries[index]!.kind === 'stay') {
      return index;
    }
  }
  return -1;
}

function overlapsDayWindow(
  entry: DayTimelineEntry,
  dayStart: Date,
  rangeEnd: Date,
): boolean {
  const end =
    entry.kind === 'stay' && entry.openThroughNow ? rangeEnd : entry.endAt;
  return (
    end.getTime() > dayStart.getTime() && entry.startAt.getTime() < rangeEnd.getTime()
  );
}

function adjustStay(
  stay: DetectedTrip,
  updates: Partial<Pick<DetectedTrip, 'startAt' | 'endAt' | 'durationMs' | 'openThroughNow'>>,
): DetectedTrip {
  return {...stay, ...updates};
}

/**
 * Map history for one calendar day: detect on lookback + day points, fill
 * midnight→first save when still at the same place, and extend the open visit
 * through now when viewing today.
 */
export function prepareDayHistoryTimeline(
  dateKey: string,
  dayPoints: LocationPointRow[],
  lookbackPoints: LocationPointRow[],
  config: TripDetectionConfig,
  referenceNow: Date = new Date(),
): DayTimelineEntry[] {
  const {start: dayStart} = getDayRange(dateKey);
  const isToday = dateKey === toDateKey(referenceNow);
  const rangeEnd = isToday ? referenceNow : endOfDay(dayStart);

  const combined = dedupeLocationPoints([...lookbackPoints, ...dayPoints]);
  const lastBeforeDay = lastPointBefore(combined, dayStart);
  const raw = buildDayTimeline(dedupeLocationPoints(dayPoints), config);

  const filtered = raw.filter(entry =>
    overlapsDayWindow(entry, dayStart, rangeEnd),
  );
  const firstStayIdx = filtered.findIndex(e => e.kind === 'stay');
  const lastStayIdx = lastStayIndex(filtered);

  return filtered.map((entry, index) => {
    if (entry.kind !== 'stay') {
      return entry;
    }

    const isFirstStay = index === firstStayIdx;
    const isLastStay = index === lastStayIdx;
    const isOpenStay = isToday && isLastStay;
    const closeStayAtDayEnd = !isToday && isLastStay;

    let stay = entry;
    const firstSave = stay.points[0]!;

    if (
      isFirstStay &&
      lastBeforeDay != null &&
      arePointsSamePlace(lastBeforeDay, firstSave, config)
    ) {
      stay = adjustStay(stay, {
        startAt: dayStart,
        durationMs: differenceInMilliseconds(stay.endAt, dayStart),
      });
    }

    if (isOpenStay) {
      stay = adjustStay(stay, {
        endAt: rangeEnd,
        durationMs: differenceInMilliseconds(rangeEnd, stay.startAt),
        openThroughNow: true,
      });
    } else if (closeStayAtDayEnd) {
      stay = adjustStay(stay, {
        endAt: rangeEnd,
        durationMs: differenceInMilliseconds(rangeEnd, stay.startAt),
      });
    }

    return stay;
  });
}

/** @deprecated Use prepareDayHistoryTimeline with today's date key. */
export function prepareTodayHistoryTimeline(
  todayPoints: LocationPointRow[],
  lookbackPoints: LocationPointRow[],
  dayStart: Date,
  now: Date,
  config: TripDetectionConfig,
): DayTimelineEntry[] {
  return prepareDayHistoryTimeline(
    toDateKey(dayStart),
    todayPoints,
    lookbackPoints,
    config,
    now,
  );
}

export function getHistoryLookbackStart(dayStart: Date): Date {
  return subHours(dayStart, LOOKBACK_HOURS);
}

/** @deprecated Use getHistoryLookbackStart */
export function getTodayHistoryLookbackStart(dayStart: Date): Date {
  return getHistoryLookbackStart(dayStart);
}

/** Open visit on today's map — last stay still in progress. */
export function getCurrentOpenVisit(
  entries: DayTimelineEntry[],
  options?: {
    userCoordinate?: {latitude: number; longitude: number} | null;
    config?: TripDetectionConfig;
  },
): DetectedTrip | null {
  if (entries.length === 0) {
    return null;
  }

  const last = entries[entries.length - 1];
  if (last.kind !== 'stay' || !last.openThroughNow) {
    return null;
  }

  const {userCoordinate, config} = options ?? {};
  if (userCoordinate != null && config != null && last.points.length > 0) {
    const anchor = last.points[last.points.length - 1]!;
    const stillHere = arePointsSamePlace(
      {lat: userCoordinate.latitude, lng: userCoordinate.longitude},
      anchor,
      config,
    );
    if (!stillHere) {
      return null;
    }
  }

  return last;
}
