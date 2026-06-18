import {
  findPlaceLookupNearAnchor,
  getPlaceLookupById,
} from '@/db/repositories/place-lookup-cache';
import {getTripByEventKey, getTripById} from '@/db/repositories/trips';
import type {SavedPlaceRow} from '@/db/repositories/saved-places';
import {
  resolveVisitPlaceDisplay,
  savedPlaceVisitDisplay,
} from '@/lib/place-lookup-display';
import type {VisitPlaceDisplay} from '@/lib/place-lookup-types';
import {matchSavedPlaceForStay} from '@/lib/saved-places';
import type {DetectedTrip} from '@/lib/trip-detection';
import {stayTripCentroid} from '@/lib/trip-detection';
import {tripEventKey} from '@/lib/trip-materialization';

async function resolveCacheRowForTrip(
  trip: NonNullable<Awaited<ReturnType<typeof getTripById>>>,
  stay: DetectedTrip,
) {
  if (trip.placeLookupCacheId != null) {
    const linked = await getPlaceLookupById(trip.placeLookupCacheId);
    if (linked) {
      return linked;
    }
  }

  const anchor = stayTripCentroid(stay);
  return findPlaceLookupNearAnchor({
    lat: anchor.latitude,
    lng: anchor.longitude,
  });
}

/** Saved place, user-selected label, or auto-selected nearby POI for a visit. */
export async function loadVisitPlaceDisplayForStay(
  stay: DetectedTrip,
  savedPlaces: readonly SavedPlaceRow[],
): Promise<VisitPlaceDisplay> {
  const savedPlace = matchSavedPlaceForStay(stay, savedPlaces);
  if (savedPlace) {
    return savedPlaceVisitDisplay(savedPlace);
  }

  let materializedTripId = stay.materializedTripId ?? null;
  if (materializedTripId == null && !stay.openThroughNow) {
    const persisted = await getTripByEventKey(tripEventKey(stay));
    materializedTripId = persisted?.id ?? null;
  }

  if (materializedTripId != null) {
    const trip = await getTripById(materializedTripId);
    if (trip) {
      const cacheRow = await resolveCacheRowForTrip(trip, stay);
      if (cacheRow) {
        const customLabel = trip.savedPlaceLabel?.trim() || null;
        const hasTripLabel =
          customLabel != null || trip.selectedCandidateIndex != null;
        return {
          ...resolveVisitPlaceDisplay(cacheRow, {
            selectedIndexOverride: trip.selectedCandidateIndex,
            isTripLabel: hasTripLabel,
            customLabel,
          }),
          materializedTripId: trip.id,
        };
      }
    }
  }

  const anchor = stayTripCentroid(stay);
  const row = await findPlaceLookupNearAnchor({
    lat: anchor.latitude,
    lng: anchor.longitude,
  });
  return {
    ...resolveVisitPlaceDisplay(row),
    materializedTripId,
  };
}
