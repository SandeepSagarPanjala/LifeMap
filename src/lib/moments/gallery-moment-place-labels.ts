import type { MomentRow } from '@/db/repositories/moments';
import type { SavedPlaceRow } from '@/db/repositories/saved-places';
import { listSavedPlaces } from '@/db/repositories/saved-places';
import type { TripRow } from '@/db/repositories/trips';
import { listTripsForDateKeys } from '@/db/repositories/trips';
import { toDateKey } from '@/lib/day-utils';
import {
  adjacentStaysForTrip,
  labelFromTripRow,
} from '@/lib/export-trip-view';
import {
  lookupSavedPlaceById,
  savedPlaceDisplayLabel,
} from '@/lib/saved-places';

/**
 * Same priority as history: POI/saved label → street address → nothing.
 * Saved places prefer the live saved-place name when placeId is set.
 */
export function stayPlaceLabelFromTrip(
  trip: Pick<TripRow, 'placeKind' | 'placeId' | 'placeLabel' | 'poiLabel'>,
  savedPlaces: readonly SavedPlaceRow[],
): string | null {
  if (trip.placeKind === 'saved' && trip.placeId != null) {
    const saved = lookupSavedPlaceById(trip.placeId, savedPlaces);
    if (saved) {
      return savedPlaceDisplayLabel(saved);
    }
  }
  return labelFromTripRow(trip);
}

function drivePlaceLabelFromDayTrips(
  dayTrips: readonly TripRow[],
  tripIndex: number,
  savedPlaces: readonly SavedPlaceRow[],
): string | null {
  const { from, to } = adjacentStaysForTrip(dayTrips, tripIndex);
  const fromLabel =
    from != null ? stayPlaceLabelFromTrip(from, savedPlaces) : null;
  const toLabel = to != null ? stayPlaceLabelFromTrip(to, savedPlaces) : null;
  if (fromLabel && toLabel) {
    return `${fromLabel} to ${toLabel}`;
  }
  return fromLabel ?? toLabel;
}

function findContainingTripIndex(
  dayTrips: readonly TripRow[],
  timestamp: Date,
): number {
  const timestampMs = timestamp.getTime();
  let travelIndex = -1;
  for (let index = 0; index < dayTrips.length; index += 1) {
    const trip = dayTrips[index]!;
    if (trip.kind === 'missing') {
      continue;
    }
    if (
      timestampMs < trip.startAt.getTime() ||
      timestampMs > trip.endAt.getTime()
    ) {
      continue;
    }
    if (trip.kind === 'stay') {
      return index;
    }
    if (trip.kind === 'travel') {
      travelIndex = index;
    }
  }
  return travelIndex;
}

function placeLabelForMoment(
  moment: MomentRow,
  dayTrips: readonly TripRow[],
  savedPlaces: readonly SavedPlaceRow[],
): string | null {
  const stored = moment.placeLabel?.trim();
  if (stored) {
    return stored;
  }

  const tripIndex = findContainingTripIndex(dayTrips, moment.timestamp);
  if (tripIndex < 0) {
    return null;
  }
  const trip = dayTrips[tripIndex]!;
  if (trip.kind === 'stay') {
    return stayPlaceLabelFromTrip(trip, savedPlaces);
  }
  if (trip.kind === 'travel') {
    return drivePlaceLabelFromDayTrips(dayTrips, tripIndex, savedPlaces);
  }
  return null;
}

/** Resolve gallery tile place labels for one day's moments. */
export function resolveGalleryPlaceLabelsByMomentId(
  moments: readonly MomentRow[],
  dayTrips: readonly TripRow[],
  savedPlaces: readonly SavedPlaceRow[],
): Map<number, string> {
  const labels = new Map<number, string>();
  for (const moment of moments) {
    const label = placeLabelForMoment(moment, dayTrips, savedPlaces);
    if (label) {
      labels.set(moment.id, label);
    }
  }
  return labels;
}

export function groupTripsByDateKey(
  trips: readonly TripRow[],
): Map<string, TripRow[]> {
  const byDay = new Map<string, TripRow[]>();
  for (const trip of trips) {
    const list = byDay.get(trip.dateKey);
    if (list) {
      list.push(trip);
    } else {
      byDay.set(trip.dateKey, [trip]);
    }
  }
  return byDay;
}

/** Batch-resolve place labels for a preview moment list (any set of days). */
export async function resolveGalleryPlaceLabelsForMoments(
  moments: readonly MomentRow[],
): Promise<Map<number, string>> {
  if (moments.length === 0) {
    return new Map();
  }

  const dateKeys = [
    ...new Set(moments.map(moment => toDateKey(moment.timestamp))),
  ];
  const momentsByDay = new Map<string, MomentRow[]>();
  for (const key of dateKeys) {
    momentsByDay.set(key, []);
  }
  for (const moment of moments) {
    momentsByDay.get(toDateKey(moment.timestamp))!.push(moment);
  }

  const [trips, savedPlaces] = await Promise.all([
    listTripsForDateKeys(dateKeys),
    listSavedPlaces(),
  ]);
  const tripsByDay = groupTripsByDateKey(trips);
  const labels = new Map<number, string>();
  for (const key of dateKeys) {
    const dayLabels = resolveGalleryPlaceLabelsByMomentId(
      momentsByDay.get(key) ?? [],
      tripsByDay.get(key) ?? [],
      savedPlaces,
    );
    for (const [id, label] of dayLabels) {
      labels.set(id, label);
    }
  }
  return labels;
}
