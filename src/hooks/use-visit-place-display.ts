import {useCallback, useEffect, useState, useSyncExternalStore} from 'react';

import {
  findPlaceLookupNearAnchor,
  getPlaceLookupById,
} from '@/db/repositories/place-lookup-cache';
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
  notifyPlaceLookupUpdated,
} from '@/lib/place-lookup-events';
import {expandPlaceLookupArea} from '@/lib/place-lookup-service';
import {PLACE_LOOKUP_VENUE_RADIUS_M} from '@/lib/place-lookup-venue';
import {
  getMaterializationRevision,
  subscribeMaterialization,
  notifyMaterializationUpdated,
} from '@/lib/trip-materialization-events';
import type {VisitPlaceDisplay} from '@/lib/place-lookup-types';
import {matchSavedPlaceForStay} from '@/lib/saved-places';
import type {DetectedTrip} from '@/lib/trip-detection';
import {stayTripCentroid} from '@/lib/trip-detection';
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

function displayForTripAndCache(
  trip: NonNullable<Awaited<ReturnType<typeof getTripById>>>,
  cacheRow: NonNullable<Awaited<ReturnType<typeof getPlaceLookupById>>>,
): VisitPlaceDisplay {
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

      if (stay.savedPlaceId != null) {
        const linkedPlace = await getSavedPlaceById(stay.savedPlaceId);
        if (!cancelled && linkedPlace) {
          setDisplay(savedPlaceVisitDisplay(linkedPlace));
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
          const cacheRow = await resolveCacheRowForTrip(trip, stay);
          if (!cancelled && cacheRow) {
            setDisplay(displayForTripAndCache(trip, cacheRow));
            return;
          }
        }
      }

      const anchor = stayTripCentroid(stay);
      const row = await findPlaceLookupNearAnchor({
        lat: anchor.latitude,
        lng: anchor.longitude,
      });
      if (!cancelled) {
        setDisplay({
          ...resolveVisitPlaceDisplay(row),
          materializedTripId,
        });
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
    const {setPlaceLookupSelectedIndex} = await import(
      '@/db/repositories/place-lookup-cache'
    );

    const trip = await ensureTripForClosedStay(args.stay, args.dateKey);
    const tripId = trip?.id ?? args.materializedTripId ?? null;

    if (tripId != null) {
      let cacheId = args.cacheId ?? trip?.placeLookupCacheId ?? null;
      if (cacheId == null) {
        const anchor = stayTripCentroid(args.stay);
        const row = await findPlaceLookupNearAnchor({
          lat: anchor.latitude,
          lng: anchor.longitude,
        });
        cacheId = row?.id ?? null;
      }

      if (cacheId == null) {
        return;
      }

      await updateTripLabelSelection(
        tripId,
        args.selectedIndex,
        cacheId,
      );
      notifyMaterializationUpdated();
      return;
    }

    if (args.cacheId == null) {
      return;
    }

    await setPlaceLookupSelectedIndex(args.cacheId, args.selectedIndex);
    notifyPlaceLookupUpdated();
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

    let cacheId = args.cacheId ?? trip?.placeLookupCacheId ?? null;
    if (cacheId == null) {
      const anchor = stayTripCentroid(args.stay);
      const row = await findPlaceLookupNearAnchor({
        lat: anchor.latitude,
        lng: anchor.longitude,
      });
      cacheId = row?.id ?? null;
    }

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
