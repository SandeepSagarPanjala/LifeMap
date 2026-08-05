import type { LocationPointRow } from '@/db/repositories/location-days';
import { getLocationPointsForDay } from '@/db/repositories/location-days';
import type { MomentRow } from '@/db/repositories/moments';
import type { TripRow } from '@/db/repositories/trips';
import { listSavedPlaces } from '@/db/repositories/saved-places';
import { getDayRange } from '@/lib/day-utils';
import type { HistoryData } from '@/lib/history-data-types';
import { buildMomentRefsForSegment } from '@/lib/moment-refs';
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

function attachMomentRefsToEntries(
  entries: readonly DayTimelineEntry[],
  moments: readonly MomentRow[],
): DayTimelineEntry[] {
  if (moments.length === 0) {
    return [...entries];
  }
  return entries.map(entry => {
    if (entry.kind !== 'stay' && entry.kind !== 'travel') {
      return entry;
    }
    const momentRefs = buildMomentRefsForSegment(
      moments,
      entry.startAt,
      entry.endAt,
    );
    if (momentRefs.length === 0) {
      return entry;
    }
    return { ...entry, momentRefs };
  });
}

/** Today map/history display — main alg + open visit through now. */
export async function buildTodayDisplayHistory(
  dateKey: string,
  detectionConfig: TripDetectionConfig,
  referenceNow: Date = new Date(),
  todayTripRows: readonly TripRow[] = [],
  moments: readonly MomentRow[] = [],
): Promise<HistoryData & { dayPointCount: number }> {
  const { start: dayStart, end: dayEnd } = getDayRange(dateKey);
  const [savedPlaces, lookbackPoints, dayPoints, placeLookup] =
    await Promise.all([
      listSavedPlaces(),
      loadYesterdayLookbackPointsForToday(dateKey, todayTripRows),
      getLocationPointsForDay(dateKey),
      loadPlaceLookupContext(),
    ]);

  const rawEntries = prepareDayHistoryTimeline(
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
      moments,
    },
    true,
  );
  const entries = attachMomentRefsToEntries(rawEntries, moments);

  return historyDataFromEntries(
    dateKey,
    dayStart,
    referenceNow,
    entries,
    dayPoints.length,
    moments,
  );
}

/** Trip detection on GPS since the seal boundary — not the full day. */
export async function buildTodayTailDisplayHistory(
  dateKey: string,
  tailStart: Date,
  detectionConfig: TripDetectionConfig,
  referenceNow: Date = new Date(),
  todayTripRows: readonly TripRow[] = [],
  /** Unsealed today moments for live detect + momentRefs. */
  moments: readonly MomentRow[] = [],
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

  const rawEntries = prepareDayHistoryTimeline(
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
      moments,
    },
    true,
  );
  const entries = attachMomentRefsToEntries(rawEntries, moments);

  return historyDataFromEntries(
    dateKey,
    dayStart,
    referenceNow,
    entries,
    dayPoints.length,
    moments,
  );
}

export function historyDataFromEntries(
  dateKey: string,
  dayStart: Date,
  rangeEnd: Date,
  entries: readonly DayTimelineEntry[],
  dayPointCount = 0,
  moments: readonly MomentRow[] = [],
): HistoryData & { dayPointCount: number } {
  const playable = entries.filter((entry): entry is DetectedTrip =>
    isPlayableTimelineEntry(entry),
  );
  return {
    dateKey,
    points: flattenTimelinePoints(playable),
    entries: [...entries],
    range: { startAt: dayStart, endAt: rangeEnd },
    moments: [...moments],
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
