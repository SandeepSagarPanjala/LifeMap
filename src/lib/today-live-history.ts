import type { LocationPointRow } from '@/db/repositories/location-days';
import { getLocationPointsForDay } from '@/db/repositories/location-days';
import type { TripRow } from '@/db/repositories/trips';
import { listSavedPlaces } from '@/db/repositories/saved-places';
import { getDayRange } from '@/lib/day-utils';
import type { HistoryData } from '@/lib/history-data-types';
import { loadPlaceLookupContext } from '@/lib/place-lookup-context';
import { prepareDayHistoryTimeline } from '@/lib/today-history';
import { loadYesterdayLookbackPointsForToday } from '@/lib/today-lookback';
import {
  isPlayableTimelineEntry,
  type DayTimelineEntry,
  type DetectedTrip,
} from '@/lib/trip-detection';
import { flattenTimelinePoints } from '@/lib/trip-geometry';
import type { TripDetectionConfig } from '@/lib/trip-settings';

/** Today map/history display — main alg + open visit through now. */
export async function buildTodayDisplayHistory(
  dateKey: string,
  detectionConfig: TripDetectionConfig,
  referenceNow: Date = new Date(),
  todayTripRows: readonly TripRow[] = [],
): Promise<HistoryData & { dayPointCount: number }> {
  const { start: dayStart, end: dayEnd } = getDayRange(dateKey);
  const [savedPlaces, lookbackPoints, dayPoints, placeLookup] =
    await Promise.all([
      listSavedPlaces(),
      loadYesterdayLookbackPointsForToday(dateKey, todayTripRows),
      getLocationPointsForDay(dateKey),
      loadPlaceLookupContext(),
    ]);

  const entries = prepareDayHistoryTimeline(
    dateKey,
    filterPointsInRange(dayPoints, dayStart, dayEnd),
    lookbackPoints,
    detectionConfig,
    referenceNow,
    [],
    {
      savedPlaces,
      placeLookupCache: placeLookup.placeLookupCache,
      placePois: placeLookup.placePois,
    },
    true,
  );

  return historyDataFromEntries(
    dateKey,
    dayStart,
    referenceNow,
    entries,
    dayPoints.length,
  );
}

/** Trip detection on GPS since the seal boundary — not the full day. */
export async function buildTodayTailDisplayHistory(
  dateKey: string,
  tailStart: Date,
  detectionConfig: TripDetectionConfig,
  referenceNow: Date = new Date(),
  todayTripRows: readonly TripRow[] = [],
): Promise<HistoryData & { dayPointCount: number }> {
  const { start: dayStart, end: dayEnd } = getDayRange(dateKey);
  const tailStartMs = tailStart.getTime();

  const [savedPlaces, lookbackPoints, dayPoints, placeLookup] =
    await Promise.all([
      listSavedPlaces(),
      loadYesterdayLookbackPointsForToday(dateKey, todayTripRows),
      getLocationPointsForDay(dateKey),
      loadPlaceLookupContext(),
    ]);

  const dayPointsInRange = filterPointsInRange(
    dayPoints,
    dayStart,
    dayEnd,
  ).filter(point => point.timestamp.getTime() >= tailStartMs);

  const entries = prepareDayHistoryTimeline(
    dateKey,
    dayPointsInRange,
    lookbackPoints,
    detectionConfig,
    referenceNow,
    [],
    {
      savedPlaces,
      placeLookupCache: placeLookup.placeLookupCache,
      placePois: placeLookup.placePois,
    },
    true,
  );

  return historyDataFromEntries(
    dateKey,
    dayStart,
    referenceNow,
    entries,
    dayPoints.length,
  );
}

export function historyDataFromEntries(
  dateKey: string,
  dayStart: Date,
  rangeEnd: Date,
  entries: readonly DayTimelineEntry[],
  dayPointCount = 0,
): HistoryData & { dayPointCount: number } {
  const playable = entries.filter((entry): entry is DetectedTrip =>
    isPlayableTimelineEntry(entry),
  );
  return {
    dateKey,
    points: flattenTimelinePoints(playable),
    entries: [...entries],
    range: { startAt: dayStart, endAt: rangeEnd },
    dayPointCount,
  };
}

function filterPointsInRange(
  points: readonly LocationPointRow[],
  rangeStart: Date,
  rangeEnd: Date,
): LocationPointRow[] {
  const startMs = rangeStart.getTime();
  const endMs = rangeEnd.getTime();
  return points.filter(point => {
    const timestampMs = point.timestamp.getTime();
    return timestampMs >= startMs && timestampMs <= endMs;
  });
}
