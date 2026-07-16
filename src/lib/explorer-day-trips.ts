import type { LocationPointRow } from '@/db/repositories/location-days';
import { getLocationPointsForDay } from '@/db/repositories/location-days';
import type { SavedPlaceRow } from '@/db/repositories/saved-places';
import { listSavedPlaces } from '@/db/repositories/saved-places';
import type { PlaceLookupRow, PlacePoiRow } from '@/lib/place-lookup-types';
import { loadPlaceLookupContext } from '@/lib/place-lookup-context';
import { shiftDateKey } from '@/lib/day-utils';
import { getOnFootDetectionEnabled } from '@/lib/on-foot-detection-settings';
import {
  buildSegmentationTimeline,
  detectSegmentsForDay,
} from '@/lib/segmentation';
import {
  dedupeLocationPoints,
  type DayTimelineEntry,
} from '@/lib/trip-detection';
import type { TripDetectionConfig } from '@/lib/trip-settings';

/** GPS rows for prev + today only — used by today's map preload and live tail. */
export async function loadTodayGpsWindow(dateKey: string): Promise<{
  windowPoints: LocationPointRow[];
  prevPointCount: number;
  dayPointCount: number;
  prevPoints: LocationPointRow[];
  dayPoints: LocationPointRow[];
}> {
  const prevKey = shiftDateKey(dateKey, -1);
  const [prevPoints, dayPoints] = await Promise.all([
    getLocationPointsForDay(prevKey),
    getLocationPointsForDay(dateKey),
  ]);
  return {
    windowPoints: dedupeLocationPoints([...prevPoints, ...dayPoints]),
    prevPointCount: prevPoints.length,
    dayPointCount: dayPoints.length,
    prevPoints,
    dayPoints,
  };
}

/** GPS rows for prev + day + next — same window as point-explorer `detectTripsForDay`. */
export async function loadExplorerGpsWindow(dateKey: string): Promise<{
  windowPoints: LocationPointRow[];
  prevPointCount: number;
  dayPointCount: number;
  nextPointCount: number;
  prevPoints: LocationPointRow[];
  dayPoints: LocationPointRow[];
  nextPoints: LocationPointRow[];
}> {
  const prevKey = shiftDateKey(dateKey, -1);
  const nextKey = shiftDateKey(dateKey, 1);
  const [prevPoints, dayPoints, nextPoints] = await Promise.all([
    getLocationPointsForDay(prevKey),
    getLocationPointsForDay(dateKey),
    getLocationPointsForDay(nextKey),
  ]);
  return {
    windowPoints: dedupeLocationPoints([
      ...prevPoints,
      ...dayPoints,
      ...nextPoints,
    ]),
    prevPointCount: prevPoints.length,
    dayPointCount: dayPoints.length,
    nextPointCount: nextPoints.length,
    prevPoints,
    dayPoints,
    nextPoints,
  };
}

/** Point-explorer day timeline — no mobile post-processing. */
export function buildExplorerDayTimeline(
  dateKey: string,
  windowPoints: readonly LocationPointRow[],
  config: TripDetectionConfig,
  savedPlaces: readonly SavedPlaceRow[] = [],
  placeLookupCache: readonly PlaceLookupRow[] = [],
  placePois: readonly PlacePoiRow[] = [],
  onFootDetectionEnabled = true,
): DayTimelineEntry[] {
  return buildSegmentationTimeline(dateKey, windowPoints, config, {
    savedPlaces,
    placeLookupCache,
    placePois,
    onFootDetectionEnabled,
  });
}

export async function buildExplorerDayTimelineFromGps(
  dateKey: string,
  config: TripDetectionConfig,
  savedPlaces?: readonly SavedPlaceRow[],
): Promise<{
  entries: DayTimelineEntry[];
  dayPointCount: number;
}> {
  const [places, placeLookup, { windowPoints, dayPointCount }, onFootDetectionEnabled] =
    await Promise.all([
      savedPlaces ? Promise.resolve(savedPlaces) : listSavedPlaces(),
      loadPlaceLookupContext(),
      loadExplorerGpsWindow(dateKey),
      getOnFootDetectionEnabled(),
    ]);
  const entries = buildExplorerDayTimeline(
    dateKey,
    windowPoints,
    config,
    places,
    placeLookup.placeLookupCache,
    placeLookup.placePois,
    onFootDetectionEnabled,
  );
  return { entries, dayPointCount };
}

export { detectSegmentsForDay };
