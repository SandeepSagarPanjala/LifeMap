import type {LocationPointRow} from '@/db/repositories/location-days';
import {
  getMomentsForDay,
  updateMomentLocation,
  type MomentRow,
} from '@/db/repositories/moments';
import {listSavedPlaces} from '@/db/repositories/saved-places';
import {getDayRange, toDateKey} from '@/lib/day-utils';
import {loadHistoryForDayCoalesced} from '@/lib/history-day-load';
import {resolveMomentLocation} from '@/lib/moments/moment-counts';
import {findContainingTimelineEntry} from '@/lib/moments/moment-timeline';
import {yieldToEventLoop} from '@/lib/run-when-idle';
import {
  matchSavedPlaceForPoint,
  matchSavedPlaceForStay,
  savedPlaceDisplayLabel,
} from '@/lib/saved-places';
import {
  DEFAULT_TRIP_DWELL_MINUTES,
  DEFAULT_TRIP_GAP_MINUTES,
  HISTORY_SAME_PLACE_RADIUS_METERS,
} from '@/lib/app-constants';
import {buildTripDetectionConfig, type TripDetectionConfig} from '@/lib/trip-settings';
import type {DayTimelineEntry} from '@/lib/trip-detection';
import type {SavedPlaceRow} from '@/db/repositories/saved-places';

function defaultTripDetectionConfig(): TripDetectionConfig {
  return buildTripDetectionConfig(
    DEFAULT_TRIP_GAP_MINUTES,
    DEFAULT_TRIP_DWELL_MINUTES,
    HISTORY_SAME_PLACE_RADIUS_METERS,
  );
}

function resolvePlaceLabelForMoment(
  moment: MomentRow,
  location: {lat: number; lng: number},
  entries: DayTimelineEntry[],
  savedPlaces: readonly SavedPlaceRow[],
): string | null {
  const savedPlaceMatch = matchSavedPlaceForPoint(location, savedPlaces);
  if (savedPlaceMatch) {
    return savedPlaceDisplayLabel(savedPlaceMatch);
  }

  const entry = findContainingTimelineEntry(moment.timestamp, entries, new Date());
  if (entry?.kind === 'stay') {
    const stayPlace = matchSavedPlaceForStay(entry, savedPlaces);
    if (stayPlace) {
      return savedPlaceDisplayLabel(stayPlace);
    }
  }

  return moment.placeLabel;
}

export async function backfillMomentLocationIfNeeded(
  moment: MomentRow,
  points: LocationPointRow[],
  entries: DayTimelineEntry[],
  savedPlaces: readonly SavedPlaceRow[],
): Promise<boolean> {
  if (moment.lat != null && moment.lng != null) {
    return false;
  }

  const location = resolveMomentLocation(moment, points, entries);
  if (!location) {
    return false;
  }

  const placeLabel = resolvePlaceLabelForMoment(
    moment,
    location,
    entries,
    savedPlaces,
  );

  await updateMomentLocation(moment.id, {
    lat: location.lat,
    lng: location.lng,
    placeLabel,
  });
  return true;
}

export async function backfillMomentsForDateKey(
  dateKey: string,
  detectionConfig: TripDetectionConfig = defaultTripDetectionConfig(),
): Promise<number> {
  const {start, end} = getDayRange(dateKey);
  const [history, savedPlaces, moments] = await Promise.all([
    loadHistoryForDayCoalesced(dateKey, detectionConfig),
    listSavedPlaces(),
    getMomentsForDay(start, end),
  ]);

  let updated = 0;
  for (const moment of moments) {
    if (moment.lat != null && moment.lng != null) {
      continue;
    }
    if (
      await backfillMomentLocationIfNeeded(
        moment,
        history.points,
        history.entries,
        savedPlaces,
      )
    ) {
      updated += 1;
    }
    await yieldToEventLoop();
  }

  return updated;
}

export function scheduleMomentLocationBackfillAfterInsert(
  moment: MomentRow,
  detectionConfig: TripDetectionConfig = defaultTripDetectionConfig(),
): void {
  const dateKey = toDateKey(moment.timestamp);
  void (async () => {
    const [history, savedPlaces] = await Promise.all([
      loadHistoryForDayCoalesced(dateKey, detectionConfig),
      listSavedPlaces(),
    ]);
    await backfillMomentLocationIfNeeded(
      moment,
      history.points,
      history.entries,
      savedPlaces,
    );
  })().catch(() => undefined);
}
