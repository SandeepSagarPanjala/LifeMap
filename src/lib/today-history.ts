import {addHours, differenceInMilliseconds, endOfDay, subHours} from 'date-fns';

import type {LocationPointRow} from '@/db/repositories/location-days';
import {getDayRange, toDateKey} from '@/lib/day-utils';
import {calculatePathDistanceKm} from '@/lib/location-geo';
import {
  arePointsSamePlace,
  isUserStillAtStay,
  dedupeLocationPoints,
  type DayTimelineEntry,
  type DetectedTrip,
  type TripTimelineOptions,
} from '@/lib/trip-detection';
import type {TripDetectionConfig} from '@/lib/trip-settings';
import {buildSegmentationTimeline} from '@/lib/segmentation';
import {shouldSplitStayAtMidnight} from '@/lib/saved-places';
import type {SavedPlaceRow} from '@/db/repositories/saved-places';
import {stayMeetsMinimumVisitDwell} from '@/lib/visit-dwell';

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

function lastPlayableIndex(entries: readonly DayTimelineEntry[]): number {
  for (let index = entries.length - 1; index >= 0; index -= 1) {
    if (entries[index]!.kind === 'stay' || entries[index]!.kind === 'travel') {
      return index;
    }
  }
  return -1;
}

/** True when no playable segment follows — drives after a stay keep it closed. */
function isTrailingPlayableEntry(
  index: number,
  entries: readonly DayTimelineEntry[],
): boolean {
  for (let nextIndex = index + 1; nextIndex < entries.length; nextIndex += 1) {
    const next = entries[nextIndex]!;
    if (next.kind === 'gap') {
      continue;
    }
    return false;
  }
  return true;
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

function adjustTravel(
  travel: DetectedTrip,
  updates: Partial<Pick<DetectedTrip, 'startAt' | 'endAt' | 'durationMs' | 'openThroughNow'>>,
): DetectedTrip {
  return {...travel, ...updates};
}

function clipTimelineEntryToDay(
  entry: DayTimelineEntry,
  dayStart: Date,
  rangeEnd: Date,
  savedPlaces: readonly SavedPlaceRow[] = [],
): DayTimelineEntry | null {
  const rawEnd =
    entry.kind === 'stay' && entry.openThroughNow ? rangeEnd : entry.endAt;
  const keepFullStaySpan =
    entry.kind === 'stay' &&
    !shouldSplitStayAtMidnight(entry, savedPlaces) &&
    (entry.startAt.getTime() < dayStart.getTime() ||
      rawEnd.getTime() > rangeEnd.getTime());

  let startMs = keepFullStaySpan
    ? entry.startAt.getTime()
    : Math.max(entry.startAt.getTime(), dayStart.getTime());
  let endMs = keepFullStaySpan
    ? rawEnd.getTime()
    : Math.min(rawEnd.getTime(), rangeEnd.getTime());

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
  savedPlaces: readonly SavedPlaceRow[] = [],
): boolean {
  if (stayMeetsMinimumVisitDwell(stay, config, savedPlaces)) {
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
  savedPlaces: readonly SavedPlaceRow[] = [],
): boolean {
  if (stayMeetsMinimumVisitDwell(stay, config, savedPlaces)) {
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
  savedPlaces: readonly SavedPlaceRow[] = [],
): boolean {
  if (stayMeetsMinimumVisitDwell(entry, config, savedPlaces)) {
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
  if (previous?.kind === 'travel' && isTrailingDriveArrivalStay(entry, previous, config, savedPlaces)) {
    return true;
  }
  if (isCrossDayDriveTailStay(entry, fullTimeline, config, savedPlaces)) {
    return true;
  }
  return false;
}

/** Drop brief false visits created when a drive is split at midnight. */
function dropMidDriveNoiseStays(
  entries: DayTimelineEntry[],
  fullTimeline: DayTimelineEntry[],
  config: TripDetectionConfig,
  savedPlaces: readonly SavedPlaceRow[] = [],
): DayTimelineEntry[] {
  return entries.filter(entry => {
    if (entry.kind !== 'stay') {
      return true;
    }
    return !isMidDriveNoiseStay(entry, fullTimeline, config, savedPlaces);
  });
}

function attachCrossDayTravelDisplay(
  entry: DetectedTrip,
  raw: DayTimelineEntry[],
  config: TripDetectionConfig,
  dayStart: Date,
  rangeEnd: Date,
  savedPlaces: readonly SavedPlaceRow[] = [],
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
      !stayMeetsMinimumVisitDwell(next, config, savedPlaces) &&
      (isMidDriveNoiseStay(next, raw, config, savedPlaces) ||
        isTrailingDriveArrivalStay(next, rawTravel, config, savedPlaces) ||
        isCrossDayDriveTailStay(next, raw, config, savedPlaces));
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
 *
 * @param forDisplay When false, skips map-only cross-day drive merging (use for DB persist).
 */
export function prepareDayHistoryTimeline(
  dateKey: string,
  dayPoints: LocationPointRow[],
  lookbackPoints: LocationPointRow[],
  config: TripDetectionConfig,
  referenceNow: Date = new Date(),
  lookaheadPoints: LocationPointRow[] = [],
  timelineOptions: TripTimelineOptions = {},
  forDisplay = true,
): DayTimelineEntry[] {
  const {start: dayStart} = getDayRange(dateKey);
  const isToday = dateKey === toDateKey(referenceNow);
  const rangeEnd = isToday ? referenceNow : endOfDay(dayStart);

  const combined = dedupeLocationPoints([
    ...lookbackPoints,
    ...dayPoints,
    ...lookaheadPoints,
  ]);
  const savedPlaces = timelineOptions.savedPlaces ?? [];
  const lastBeforeDay = lastPointBefore(combined, dayStart);
  const raw = buildSegmentationTimeline(
    dateKey,
    combined,
    config,
    timelineOptions,
  );

  const filtered = dropMidDriveNoiseStays(
    raw
      .filter(entry => overlapsDayWindow(entry, dayStart, rangeEnd))
      .map(entry => clipTimelineEntryToDay(entry, dayStart, rangeEnd, savedPlaces))
      .filter((entry): entry is DayTimelineEntry => entry != null),
    raw,
    config,
    savedPlaces,
  );
  const firstStayIdx = filtered.findIndex(e => e.kind === 'stay');
  const lastStayIdx = lastStayIndex(filtered);
  const lastPlayableIdx = lastPlayableIndex(filtered);
  const driveCrossesMidnight = hasTravelCrossingDayStart(raw, dayStart);

  return filtered.map((entry, index) => {
    if (entry.kind === 'travel') {
      let travel = entry;
      if (forDisplay) {
        travel = attachCrossDayTravelDisplay(
          travel,
          raw,
          config,
          dayStart,
          rangeEnd,
          savedPlaces,
        );
      }
      const isOpenTravel =
        isToday &&
        index === lastPlayableIdx &&
        isTrailingPlayableEntry(index, filtered);
      if (isOpenTravel) {
        travel = adjustTravel(travel, {
          endAt: rangeEnd,
          durationMs: differenceInMilliseconds(rangeEnd, travel.startAt),
          openThroughNow: true,
        });
      }
      return travel;
    }

    if (entry.kind !== 'stay') {
      return entry;
    }

    const isFirstStay = index === firstStayIdx;
    const isLastStay = index === lastStayIdx;
    const isOpenStay =
      isToday &&
      isLastStay &&
      isTrailingPlayableEntry(index, filtered) &&
      !isMidDriveNoiseStay(entry, raw, config, savedPlaces);
    const closeStayAtDayEnd =
      !isToday &&
      isLastStay &&
      !isMidDriveNoiseStay(entry, raw, config, savedPlaces) &&
      entry.endAt.getTime() <= rangeEnd.getTime() &&
      toDateKey(entry.startAt) === toDateKey(rangeEnd);

    let stay = entry;
    const firstSave = stay.points[0]!;

    if (
      isFirstStay &&
      lastBeforeDay != null &&
      !driveCrossesMidnight &&
      arePointsSamePlace(lastBeforeDay, firstSave, config) &&
      shouldSplitStayAtMidnight(stay, savedPlaces)
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

export function getHistoryLookbackStart(
  dayStart: Date,
  hours: number = LOOKBACK_HOURS,
): Date {
  return subHours(dayStart, hours);
}

export function getHistoryLookaheadEnd(
  dayEnd: Date,
  hours: number = LOOKAHEAD_HOURS,
): Date {
  return addHours(dayEnd, hours);
}

/** @deprecated Use getHistoryLookbackStart */
export function getTodayHistoryLookbackStart(dayStart: Date): Date {
  return getHistoryLookbackStart(dayStart);
}

/** Last open stay or drive on today's map. */
export function getCurrentOpenActivity(
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
  if (
    (last.kind !== 'stay' && last.kind !== 'travel') ||
    !last.openThroughNow
  ) {
    return null;
  }

  if (last.kind === 'travel') {
    return last;
  }

  const {userCoordinate, config} = options ?? {};
  if (userCoordinate != null && config != null) {
    const stillHere = isUserStillAtStay(
      {lat: userCoordinate.latitude, lng: userCoordinate.longitude},
      last,
      config,
    );
    if (!stillHere) {
      return null;
    }
  }

  return last;
}

/** Open visit on today's map — last stay still in progress. */
export function getCurrentOpenVisit(
  entries: DayTimelineEntry[],
  options?: {
    userCoordinate?: {latitude: number; longitude: number} | null;
    config?: TripDetectionConfig;
  },
): DetectedTrip | null {
  const activity = getCurrentOpenActivity(entries, options);
  return activity?.kind === 'stay' ? activity : null;
}
