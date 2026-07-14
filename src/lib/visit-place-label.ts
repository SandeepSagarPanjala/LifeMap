import { getPlaceLookupById } from '@/db/repositories/place-lookup-cache';
import { listPlacePoisForCache } from '@/db/repositories/place-pois';
import { getTripByEventKey, getTripById } from '@/db/repositories/trips';
import { getSavedPlaceById } from '@/db/repositories/saved-places';
import type { SavedPlaceRow } from '@/db/repositories/saved-places';
import { toDateKey } from '@/lib/day-utils';
import {
  resolveVisitPlaceDisplay,
  savedPlaceVisitDisplay,
} from '@/lib/place-lookup-display';
import type { VisitPlaceDisplay } from '@/lib/place-lookup-types';
import { resolvedPlaceFromTripRow } from '@/lib/resolved-place';
import { matchSavedPlaceForStay } from '@/lib/saved-places';
import type { DetectedTrip } from '@/lib/trip-detection';
import { tripEventKey } from '@/lib/trip-materialization';
import {
  loadVisitLabelOverrideForStay,
  shouldApplyVisitLabelOverride,
  visitLabelOverrideToResolved,
} from '@/lib/visit-label-override';

/** Saved place or cache address + optional POI for a visit. */
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

  let materializedTripId = stay.materializedTripId ?? null;
  let placeLabel = stay.placeLabel ?? null;
  let placeId = stay.placeId ?? null;
  let placeKind = stay.placeKind ?? null;
  let poiId = stay.poiId ?? null;
  let poiLabel = stay.poiLabel ?? null;

  if (materializedTripId == null && !stay.openThroughNow) {
    const persisted = await getTripByEventKey(tripEventKey(stay));
    materializedTripId = persisted?.id ?? null;
    if (persisted) {
      const resolved = resolvedPlaceFromTripRow(persisted);
      placeLabel = resolved.placeLabel;
      placeId = resolved.placeId;
      placeKind = resolved.placeKind;
      poiId = resolved.poiId;
      poiLabel = resolved.poiLabel;
    }
  } else if (materializedTripId != null) {
    const trip = await getTripById(materializedTripId);
    if (trip) {
      const resolved = resolvedPlaceFromTripRow(trip);
      placeLabel = resolved.placeLabel;
      placeId = resolved.placeId;
      placeKind = resolved.placeKind;
      poiId = resolved.poiId;
      poiLabel = resolved.poiLabel;
    }
  }

  if (
    shouldApplyVisitLabelOverride({
      materializedTripId,
      poiId,
      openThroughNow: stay.openThroughNow,
    })
  ) {
    const override = await loadVisitLabelOverrideForStay(
      toDateKey(stay.startAt),
      stay.startAt,
    );
    if (override) {
      const resolved = visitLabelOverrideToResolved(override, {
        placeLabel,
        placeId,
        placeKind,
        poiId,
        poiLabel,
        poiCategory: null,
      });
      placeLabel = resolved.placeLabel;
      placeId = resolved.placeId;
      placeKind = resolved.placeKind;
      poiId = resolved.poiId;
      poiLabel = resolved.poiLabel;
    }
  }

  if (placeKind === 'saved' && placeId != null) {
    const linkedPlace = await getSavedPlaceById(placeId);
    if (linkedPlace) {
      return savedPlaceVisitDisplay(linkedPlace);
    }
  }

  if (placeKind === 'cache' && placeId != null) {
    const cacheRow = await getPlaceLookupById(placeId);
    const pois = await listPlacePoisForCache(placeId);
    return resolveVisitPlaceDisplay({
      placeKind: 'cache',
      placeLabel,
      poiId,
      poiLabel,
      cacheId: placeId,
      pois,
      materializedTripId,
      venueRadiusMeters: cacheRow?.venueRadiusMeters,
    });
  }

  return resolveVisitPlaceDisplay({
    placeLabel,
    materializedTripId,
  });
}
