import type {LocationPointRow} from '@/db/repositories/location-days';
import {listSavedPlaces} from '@/db/repositories/saved-places';
import {getDayRange} from '@/lib/day-utils';
import type {HistoryData} from '@/lib/history-data-types';
import {loadExplorerGpsWindow} from '@/lib/explorer-day-trips';
import {prepareDayHistoryTimeline} from '@/lib/today-history';
import {
  isPlayableTimelineEntry,
  type DayTimelineEntry,
  type DetectedTrip,
} from '@/lib/trip-detection';
import {flattenTimelinePoints} from '@/lib/trip-geometry';
import type {TripDetectionConfig} from '@/lib/trip-settings';

/** Today map/history display — main alg + open visit through now. */
export async function buildTodayDisplayHistory(
  dateKey: string,
  detectionConfig: TripDetectionConfig,
  referenceNow: Date = new Date(),
): Promise<HistoryData & {dayPointCount: number}> {
  const {start: dayStart, end: dayEnd} = getDayRange(dateKey);
  const [savedPlaces, {windowPoints, dayPointCount}] = await Promise.all([
    listSavedPlaces(),
    loadExplorerGpsWindow(dateKey),
  ]);

  const dayPoints = filterPointsInRange(windowPoints, dayStart, dayEnd);
  const lookbackPoints = windowPoints.filter(
    point => point.timestamp.getTime() < dayStart.getTime(),
  );

  const entries = prepareDayHistoryTimeline(
    dateKey,
    dayPoints,
    lookbackPoints,
    detectionConfig,
    referenceNow,
    [],
    {savedPlaces},
    true,
  );

  return historyDataFromEntries(
    dateKey,
    dayStart,
    referenceNow,
    entries,
    dayPointCount,
  );
}

/** Trip detection on GPS since the seal boundary — not the full day. */
export async function buildTodayTailDisplayHistory(
  dateKey: string,
  tailStart: Date,
  detectionConfig: TripDetectionConfig,
  referenceNow: Date = new Date(),
): Promise<HistoryData & {dayPointCount: number}> {
  const {start: dayStart, end: dayEnd} = getDayRange(dateKey);
  const [savedPlaces, {windowPoints, dayPointCount}] = await Promise.all([
    listSavedPlaces(),
    loadExplorerGpsWindow(dateKey),
  ]);

  const tailStartMs = tailStart.getTime();
  const dayPoints = filterPointsInRange(windowPoints, dayStart, dayEnd).filter(
    point => point.timestamp.getTime() >= tailStartMs,
  );
  const lookbackPoints = windowPoints.filter(
    point => point.timestamp.getTime() < dayStart.getTime(),
  );

  const entries = prepareDayHistoryTimeline(
    dateKey,
    dayPoints,
    lookbackPoints,
    detectionConfig,
    referenceNow,
    [],
    {savedPlaces},
    true,
  );

  return historyDataFromEntries(
    dateKey,
    dayStart,
    referenceNow,
    entries,
    dayPointCount,
  );
}

export function historyDataFromEntries(
  dateKey: string,
  dayStart: Date,
  rangeEnd: Date,
  entries: readonly DayTimelineEntry[],
  dayPointCount = 0,
): HistoryData & {dayPointCount: number} {
  const playable = entries.filter((entry): entry is DetectedTrip =>
    isPlayableTimelineEntry(entry),
  );
  return {
    dateKey,
    points: flattenTimelinePoints(playable),
    entries: [...entries],
    range: {startAt: dayStart, endAt: rangeEnd},
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
