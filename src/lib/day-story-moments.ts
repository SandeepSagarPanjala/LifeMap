import type { LocationPointRow } from '@/db/repositories/location-days';
import type { MomentRow } from '@/db/repositories/moments';
import type { SavedPlaceRow } from '@/db/repositories/saved-places';
import type { DayStoryStop } from '@/lib/day-story-stops';
import {
  countMoments,
  emptyMomentCounts,
  filterMomentsForStayEntry,
  type MomentCounts,
} from '@/lib/moments/moment-counts';
import type { DayTimelineEntry } from '@/lib/trip-detection';

/**
 * Union moments for a day-story stop across every visit (and place-level for
 * Home/saved), so card chips and preview open the same set.
 */
export function collectMomentsForDayStoryStop(
  stop: DayStoryStop,
  dayMoments: readonly MomentRow[],
  savedPlaces: readonly SavedPlaceRow[],
  historyPoints: readonly LocationPointRow[],
  historyEntries: readonly DayTimelineEntry[],
  dwellRadiusMeters: number,
): MomentRow[] {
  if (dayMoments.length === 0 || stop.stays.length === 0) {
    return [];
  }

  const savedPlace =
    stop.savedPlaceId != null
      ? savedPlaces.find(place => place.id === stop.savedPlaceId) ?? null
      : null;

  const byId = new Map<number, MomentRow>();
  for (const stay of stop.stays) {
    const visitMoments = filterMomentsForStayEntry(
      dayMoments as MomentRow[],
      stay,
      {
        savedPlace: null,
        dwellRadiusMeters,
        points: historyPoints as LocationPointRow[],
        entries: historyEntries as DayTimelineEntry[],
        aggregation: 'visit',
      },
    );
    for (const moment of visitMoments) {
      byId.set(moment.id, moment);
    }
  }

  if (savedPlace != null) {
    const placeMoments = filterMomentsForStayEntry(
      dayMoments as MomentRow[],
      stop.stays[0]!,
      {
        savedPlace,
        dwellRadiusMeters,
        points: historyPoints as LocationPointRow[],
        entries: historyEntries as DayTimelineEntry[],
        aggregation: 'place',
      },
    );
    for (const moment of placeMoments) {
      byId.set(moment.id, moment);
    }
  }

  return [...byId.values()].sort(
    (a, b) => a.timestamp.getTime() - b.timestamp.getTime(),
  );
}

export function momentCountsForDayStoryStop(
  stop: DayStoryStop,
  dayMoments: readonly MomentRow[],
  savedPlaces: readonly SavedPlaceRow[],
  historyPoints: readonly LocationPointRow[],
  historyEntries: readonly DayTimelineEntry[],
  dwellRadiusMeters: number,
): MomentCounts {
  const moments = collectMomentsForDayStoryStop(
    stop,
    dayMoments,
    savedPlaces,
    historyPoints,
    historyEntries,
    dwellRadiusMeters,
  );
  if (moments.length === 0) {
    return emptyMomentCounts();
  }
  return countMoments(moments);
}
