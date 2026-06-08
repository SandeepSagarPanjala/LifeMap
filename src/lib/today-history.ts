import {addHours, differenceInMilliseconds, endOfDay, subHours} from 'date-fns';

import type {LocationPointRow} from '@/db/repositories/location-days';
import {getDayRange, toDateKey} from '@/lib/day-utils';
import {calculatePathDistanceKm} from '@/lib/location-geo';
import {
  arePointsSamePlace,
  buildDayTimeline,
  dedupeLocationPoints,
  type DayTimelineEntry,
  type DetectedTrip,
} from '@/lib/trip-detection';
import type {TripDetectionConfig} from '@/lib/trip-settings';

const LOOKBACK_HOURS = 48;
const LOOKAHEAD_HOURS = 48;

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

function clipTimelineEntryToDay(
  entry: DayTimelineEntry,
  dayStart: Date,
  rangeEnd: Date,
): DayTimelineEntry | null {
  const rawEnd =
    entry.kind === 'stay' && entry.openThroughNow ? rangeEnd : entry.endAt;
  let startMs = Math.max(entry.startAt.getTime(), dayStart.getTime());
  let endMs = Math.min(rawEnd.getTime(), rangeEnd.getTime());

  if (endMs <= startMs) {
    const overlapsWindow =
      entry.startAt.getTime() <= rangeEnd.getTime() &&
      rawEnd.getTime() >= dayStart.getTime();
    if (!overlapsWindow) {
      return null;
    }
    const anchorMs = Math.min(
      Math.max(entry.startAt.getTime(), dayStart.getTime()),
      rangeEnd.getTime(),
    );
    startMs = anchorMs;
    endMs = Math.max(anchorMs, Math.min(rawEnd.getTime(), rangeEnd.getTime()));
    if (endMs <= startMs) {
      endMs = startMs + 1;
    }
  }

  const startAt = new Date(startMs);
  const endAt = new Date(endMs);
  const durationMs = differenceInMilliseconds(endAt, startAt);

  if (entry.kind === 'gap') {
    return {
      ...entry,
      startAt,
      endAt,
      durationMs,
    };
  }

  const points = entry.points.filter(point => {
    const timestampMs = point.timestamp.getTime();
    return timestampMs >= startMs && timestampMs <= endMs;
  });

  return {
    ...entry,
    startAt,
    endAt,
    durationMs,
    points,
    openThroughNow: undefined,
  };
}

function hasTravelCrossingDayStart(
  entries: DayTimelineEntry[],
  dayStart: Date,
): boolean {
  const dayStartMs = dayStart.getTime();
  return entries.some(
    entry =>
      entry.kind === 'travel' &&
      entry.startAt.getTime() < dayStartMs &&
      entry.endAt.getTime() > dayStartMs,
  );
}

function isCrossDayDriveTailStay(
  stay: DetectedTrip,
  fullTimeline: DayTimelineEntry[],
  config: TripDetectionConfig,
): boolean {
  const minStayMs = config.dwellMinutes * 60_000;
  if (stay.durationMs >= minStayMs) {
    return false;
  }

  const fullIndex = fullTimeline.findIndex(candidate => candidate.id === stay.id);
  const previous = fullIndex > 0 ? fullTimeline[fullIndex - 1] : null;
  if (previous?.kind !== 'travel') {
    return false;
  }

  return toDateKey(previous.startAt) !== toDateKey(previous.endAt);
}

function isTrailingDriveArrivalStay(
  stay: DetectedTrip,
  travel: DetectedTrip,
  config: TripDetectionConfig,
): boolean {
  const minStayMs = config.dwellMinutes * 60_000;
  if (stay.durationMs >= minStayMs) {
    return false;
  }

  const lastTravelPoint = travel.points[travel.points.length - 1];
  const firstStayPoint = stay.points[0];
  if (lastTravelPoint == null || firstStayPoint == null) {
    return false;
  }

  return arePointsSamePlace(lastTravelPoint, firstStayPoint, config);
}

function isMidDriveNoiseStay(
  entry: DetectedTrip,
  fullTimeline: DayTimelineEntry[],
  config: TripDetectionConfig,
): boolean {
  const minStayMs = config.dwellMinutes * 60_000;
  if (entry.durationMs >= minStayMs) {
    return false;
  }

  const fullIndex = fullTimeline.findIndex(candidate => candidate.id === entry.id);
  if (fullIndex < 0) {
    return false;
  }

  const previous = fullTimeline[fullIndex - 1];
  const next = fullTimeline[fullIndex + 1];
  if (previous?.kind === 'travel' && next?.kind === 'travel') {
    return true;
  }
  if (previous?.kind === 'travel' && isTrailingDriveArrivalStay(entry, previous, config)) {
    return true;
  }
  if (isCrossDayDriveTailStay(entry, fullTimeline, config)) {
    return true;
  }
  return false;
}

/** Drop brief false visits created when a drive is split at midnight. */
function dropMidDriveNoiseStays(
  entries: DayTimelineEntry[],
  fullTimeline: DayTimelineEntry[],
  config: TripDetectionConfig,
): DayTimelineEntry[] {
  return entries.filter(entry => {
    if (entry.kind !== 'stay') {
      return true;
    }
    return !isMidDriveNoiseStay(entry, fullTimeline, config);
  });
}

function attachCrossDayTravelDisplay(
  entry: DetectedTrip,
  raw: DayTimelineEntry[],
  config: TripDetectionConfig,
  dayStart: Date,
  rangeEnd: Date,
): DetectedTrip {
  const rawIndex = raw.findIndex(
    candidate => candidate.id === entry.id && candidate.kind === 'travel',
  );
  if (rawIndex < 0 || raw[rawIndex]?.kind !== 'travel') {
    return entry;
  }

  const rawTravel = raw[rawIndex] as DetectedTrip;
  let fullEndAt = rawTravel.endAt;
  const fullPoints = [...rawTravel.points];

  for (let index = rawIndex + 1; index < raw.length; index += 1) {
    const next = raw[index]!;
    if (next.kind !== 'stay') {
      break;
    }
    const absorbed =
      isMidDriveNoiseStay(next, raw, config) ||
      isTrailingDriveArrivalStay(next, rawTravel, config) ||
      isCrossDayDriveTailStay(next, raw, config);
    if (!absorbed) {
      break;
    }
    fullPoints.push(...next.points);
    fullEndAt = next.endAt;
  }

  const crossesDayStart =
    rawTravel.startAt.getTime() < dayStart.getTime() &&
    fullEndAt.getTime() > dayStart.getTime();
  const crossesDayEnd =
    rawTravel.startAt.getTime() <= rangeEnd.getTime() &&
    fullEndAt.getTime() > rangeEnd.getTime();
  if (!crossesDayStart && !crossesDayEnd) {
    return entry;
  }

  return {
    ...entry,
    startAt: rawTravel.startAt,
    endAt: fullEndAt,
    points: fullPoints,
    durationMs: differenceInMilliseconds(fullEndAt, rawTravel.startAt),
    distanceKm: calculatePathDistanceKm(fullPoints),
  };
}

/**
 * Map history for one calendar day: detect on lookback + day + lookahead points,
 * fill midnight→first save when still at the same place, and extend the open visit
 * through now when viewing today.
 */
export function prepareDayHistoryTimeline(
  dateKey: string,
  dayPoints: LocationPointRow[],
  lookbackPoints: LocationPointRow[],
  config: TripDetectionConfig,
  referenceNow: Date = new Date(),
  lookaheadPoints: LocationPointRow[] = [],
): DayTimelineEntry[] {
  const {start: dayStart} = getDayRange(dateKey);
  const isToday = dateKey === toDateKey(referenceNow);
  const rangeEnd = isToday ? referenceNow : endOfDay(dayStart);

  const combined = dedupeLocationPoints([
    ...lookbackPoints,
    ...dayPoints,
    ...lookaheadPoints,
  ]);
  const lastBeforeDay = lastPointBefore(combined, dayStart);
  const raw = buildDayTimeline(combined, config);

  const filtered = dropMidDriveNoiseStays(
    raw
      .filter(entry => overlapsDayWindow(entry, dayStart, rangeEnd))
      .map(entry => clipTimelineEntryToDay(entry, dayStart, rangeEnd))
      .filter((entry): entry is DayTimelineEntry => entry != null),
    raw,
    config,
  );
  const firstStayIdx = filtered.findIndex(e => e.kind === 'stay');
  const lastStayIdx = lastStayIndex(filtered);
  const driveCrossesMidnight = hasTravelCrossingDayStart(raw, dayStart);

  return filtered.map((entry, index) => {
    if (entry.kind === 'travel') {
      return attachCrossDayTravelDisplay(
        entry,
        raw,
        config,
        dayStart,
        rangeEnd,
      );
    }

    if (entry.kind !== 'stay') {
      return entry;
    }

    const isFirstStay = index === firstStayIdx;
    const isLastStay = index === lastStayIdx;
    const isOpenStay =
      isToday && isLastStay && !isMidDriveNoiseStay(entry, raw, config);
    const closeStayAtDayEnd =
      !isToday && isLastStay && !isMidDriveNoiseStay(entry, raw, config);

    let stay = entry;
    const firstSave = stay.points[0]!;

    if (
      isFirstStay &&
      lastBeforeDay != null &&
      !driveCrossesMidnight &&
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

export function getHistoryLookaheadEnd(dayEnd: Date): Date {
  return addHours(dayEnd, LOOKAHEAD_HOURS);
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
