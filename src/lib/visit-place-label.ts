import {getPlaceLookupById} from '@/db/repositories/place-lookup-cache';
import {getTripByEventKey, getTripById} from '@/db/repositories/trips';
import {getSavedPlaceById} from '@/db/repositories/saved-places';
import type {SavedPlaceRow} from '@/db/repositories/saved-places';
import {
  resolveVisitPlaceDisplay,
  savedPlaceVisitDisplay,
} from '@/lib/place-lookup-display';
import type {VisitPlaceDisplay} from '@/lib/place-lookup-types';
import {resolvedPlaceFromTripRow} from '@/lib/resolved-place';
import {matchSavedPlaceForStay} from '@/lib/saved-places';
import type {DetectedTrip} from '@/lib/trip-detection';
import {tripEventKey} from '@/lib/trip-materialization';

/** Saved place, user-selected label, or auto-selected nearby POI for a visit. */
export async function loadVisitPlaceDisplayForStay(
  stay: DetectedTrip,
  savedPlaces: readonly SavedPlaceRow[],
): Promise<VisitPlaceDisplay> {
  const savedPlace = matchSavedPlaceForStay(stay, savedPlaces);
  if (savedPlace) {
    return savedPlaceVisitDisplay(savedPlace);
  }

  if (stay.placeKind === 'saved' && stay.placeId != null) {
    const linkedPlace = await getSavedPlaceById(stay.placeId);
    if (linkedPlace) {
      return savedPlaceVisitDisplay(linkedPlace);
    }
  }

  if (stay.placeKind === 'cache' && stay.placeId != null) {
    const cacheRow = await getPlaceLookupById(stay.placeId);
    if (cacheRow) {
      const customLabel = stay.placeLabel?.trim() || null;
      const hasTripLabel = customLabel != null;
      return {
        ...resolveVisitPlaceDisplay(cacheRow, {
          isTripLabel: hasTripLabel,
          customLabel,
        }),
        materializedTripId: stay.materializedTripId ?? null,
      };
    }
  }

  let materializedTripId = stay.materializedTripId ?? null;
  if (materializedTripId == null && !stay.openThroughNow) {
    const persisted = await getTripByEventKey(tripEventKey(stay));
    materializedTripId = persisted?.id ?? null;
  }

  if (materializedTripId != null) {
    const trip = await getTripById(materializedTripId);
    if (trip) {
      const resolved = resolvedPlaceFromTripRow(trip);
      if (resolved.placeKind === 'saved' && resolved.placeId != null) {
        const linkedPlace = await getSavedPlaceById(resolved.placeId);
        if (linkedPlace) {
          return savedPlaceVisitDisplay(linkedPlace);
        }
      }
      if (resolved.placeKind === 'cache' && resolved.placeId != null) {
        const cacheRow = await getPlaceLookupById(resolved.placeId);
        if (cacheRow) {
          const customLabel =
            trip.placeLabel?.trim() || resolved.placeLabel?.trim() || null;
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
  }

  return {
    source: 'none',
    primaryLabel: stay.placeLabel?.trim() || null,
    customLabel: null,
    candidates: [],
    selectedIndex: 0,
    cacheId: null,
    materializedTripId,
    loading: false,
    venueRadiusMeters: 0,
    isAreaDefault: false,
    isTripLabel: false,
  };
}
