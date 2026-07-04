import {useCallback, useEffect, useState, useSyncExternalStore} from 'react';

import {getPlaceLookupById} from '@/db/repositories/place-lookup-cache';
import {
  getTripByEventKey,
  getTripById,
  updateTripCustomLabel,
  updateTripLabelSelection,
} from '@/db/repositories/trips';
import {
  getSavedPlaceById,
  type SavedPlaceRow,
} from '@/db/repositories/saved-places';
import {
  resolveVisitPlaceDisplay,
  savedPlaceVisitDisplay,
} from '@/lib/place-lookup-display';
import {
  getPlaceLookupRevision,
  subscribePlaceLookup,
} from '@/lib/place-lookup-events';
import {expandPlaceLookupArea} from '@/lib/place-lookup-service';
import {PLACE_LOOKUP_VENUE_RADIUS_M} from '@/lib/app-constants';
import {
  getMaterializationRevision,
  subscribeMaterialization,
  notifyMaterializationUpdated,
} from '@/lib/trip-materialization-events';
import type {VisitPlaceDisplay} from '@/lib/place-lookup-types';
import {resolvedPlaceFromTripRow} from '@/lib/resolved-place';
import {matchSavedPlaceForStay} from '@/lib/saved-places';
import type {DetectedTrip} from '@/lib/trip-detection';
import {
  ensureTripForClosedStay,
  tripEventKey,
} from '@/lib/trip-materialization';

const EMPTY_DISPLAY: VisitPlaceDisplay = {
  source: 'none',
  primaryLabel: null,
  customLabel: null,
  candidates: [],
  selectedIndex: 0,
  cacheId: null,
  materializedTripId: null,
  loading: false,
  venueRadiusMeters: PLACE_LOOKUP_VENUE_RADIUS_M,
  isAreaDefault: false,
  isTripLabel: false,
};

function displayForTripAndCache(
  trip: NonNullable<Awaited<ReturnType<typeof getTripById>>>,
  cacheRow: NonNullable<Awaited<ReturnType<typeof getPlaceLookupById>>>,
): VisitPlaceDisplay {
  const customLabel = trip.placeLabel?.trim() || null;
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

export function useVisitPlaceDisplay(
  stay: DetectedTrip | null,
  savedPlaces: SavedPlaceRow[],
): VisitPlaceDisplay {
  const placeRevision = useSyncExternalStore(
    subscribePlaceLookup,
    getPlaceLookupRevision,
    getPlaceLookupRevision,
  );
  const materializationRevision = useSyncExternalStore(
    subscribeMaterialization,
    getMaterializationRevision,
    getMaterializationRevision,
  );
  const [display, setDisplay] = useState<VisitPlaceDisplay>(EMPTY_DISPLAY);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!stay) {
        if (!cancelled) {
          setDisplay(EMPTY_DISPLAY);
        }
        return;
      }

      const savedPlace = matchSavedPlaceForStay(stay, savedPlaces);
      if (savedPlace) {
        if (!cancelled) {
          setDisplay(savedPlaceVisitDisplay(savedPlace));
        }
        return;
      }

      if (stay.placeKind === 'saved' && stay.placeId != null) {
        const linkedPlace = await getSavedPlaceById(stay.placeId);
        if (!cancelled && linkedPlace) {
          setDisplay(savedPlaceVisitDisplay(linkedPlace));
          return;
        }
      }

      if (stay.placeKind === 'cache' && stay.placeId != null) {
        const cacheRow = await getPlaceLookupById(stay.placeId);
        if (!cancelled && cacheRow) {
          const customLabel = stay.placeLabel?.trim() || null;
          setDisplay({
            ...resolveVisitPlaceDisplay(cacheRow, {
              isTripLabel: customLabel != null,
              customLabel,
            }),
            materializedTripId: stay.materializedTripId ?? null,
          });
          return;
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
            if (!cancelled && linkedPlace) {
              setDisplay(savedPlaceVisitDisplay(linkedPlace));
              return;
            }
          }
          if (resolved.placeKind === 'cache' && resolved.placeId != null) {
            const cacheRow = await getPlaceLookupById(resolved.placeId);
            if (!cancelled && cacheRow) {
              setDisplay(displayForTripAndCache(trip, cacheRow));
              return;
            }
          }
        }
      }

      if (!cancelled) {
        const label = stay.placeLabel?.trim() || null;
        setDisplay(
          label != null
            ? {...EMPTY_DISPLAY, primaryLabel: label, materializedTripId}
            : {...EMPTY_DISPLAY, materializedTripId},
        );
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [stay, savedPlaces, placeRevision, materializationRevision]);

  return display;
}

export type SelectVisitPlaceCandidateArgs = {
  cacheId: number | null;
  selectedIndex: number;
  stay: DetectedTrip;
  dateKey: string;
  materializedTripId?: number | null;
};

export function useSelectVisitPlaceCandidate() {
  return useCallback(async (args: SelectVisitPlaceCandidateArgs) => {
    const trip = await ensureTripForClosedStay(args.stay, args.dateKey);
    const tripId = trip?.id ?? args.materializedTripId ?? null;

    if (tripId == null) {
      return;
    }

    const resolved = trip != null ? resolvedPlaceFromTripRow(trip) : null;
    const cacheId =
      args.cacheId ??
      (resolved?.placeKind === 'cache' ? resolved.placeId : null) ??
      (args.stay.placeKind === 'cache' ? args.stay.placeId ?? null : null);

    if (cacheId == null) {
      return;
    }

    await updateTripLabelSelection(tripId, args.selectedIndex, cacheId);
    notifyMaterializationUpdated();
  }, []);
}

export type SetCustomVisitPlaceLabelArgs = {
  cacheId: number | null;
  label: string;
  stay: DetectedTrip;
  dateKey: string;
  materializedTripId?: number | null;
};

export function useSetCustomVisitPlaceLabel() {
  return useCallback(async (args: SetCustomVisitPlaceLabelArgs) => {
    const trimmed = args.label.trim();
    if (!trimmed) {
      return;
    }

    const trip = await ensureTripForClosedStay(args.stay, args.dateKey);
    const tripId = trip?.id ?? args.materializedTripId ?? null;
    if (tripId == null) {
      return;
    }

    const resolved = trip != null ? resolvedPlaceFromTripRow(trip) : null;
    const cacheId =
      args.cacheId ??
      (resolved?.placeKind === 'cache' ? resolved.placeId : null) ??
      (args.stay.placeKind === 'cache' ? args.stay.placeId ?? null : null);

    await updateTripCustomLabel(tripId, trimmed, cacheId);
    notifyMaterializationUpdated();
  }, []);
}

export function useExpandVisitPlaceLookupArea() {
  return useCallback(async (cacheId: number | null) => {
    if (cacheId == null) {
      return false;
    }
    return expandPlaceLookupArea(cacheId);
  }, []);
}
