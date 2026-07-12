import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';

import { getPlaceLookupById } from '@/db/repositories/place-lookup-cache';
import {
  insertPlacePoi,
  listPlacePoisForCache,
} from '@/db/repositories/place-pois';
import {
  getTripByEventKey,
  getTripById,
  updateTripPoiSelection,
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
import { PLACE_LOOKUP_VENUE_RADIUS_M } from '@/lib/app-constants';
import {
  getMaterializationRevision,
  subscribeMaterialization,
  notifyMaterializationUpdated,
} from '@/lib/trip-materialization-events';
import type { VisitPlaceDisplay } from '@/lib/place-lookup-types';
import { resolvedPlaceFromTripRow } from '@/lib/resolved-place';
import { matchSavedPlaceForStay } from '@/lib/saved-places';
import type { DetectedTrip } from '@/lib/trip-detection';
import {
  ensureTripForClosedStay,
  tripEventKey,
} from '@/lib/trip-materialization';
import { resolveStayAnchor } from '@/lib/trip-detection';

const EMPTY_DISPLAY: VisitPlaceDisplay = {
  source: 'none',
  addressLabel: null,
  primaryLabel: null,
  candidates: [],
  selectedPoiId: null,
  cacheId: null,
  materializedTripId: null,
  loading: false,
  venueRadiusMeters: PLACE_LOOKUP_VENUE_RADIUS_M,
};

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

      let materializedTripId = stay.materializedTripId ?? null;
      let poiId = stay.poiId ?? null;
      let poiLabel = stay.poiLabel ?? null;
      let placeLabel = stay.placeLabel ?? null;
      let placeId = stay.placeId ?? null;
      let placeKind = stay.placeKind ?? null;

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

      if (placeKind === 'saved' && placeId != null) {
        const linkedPlace = await getSavedPlaceById(placeId);
        if (!cancelled && linkedPlace) {
          setDisplay(savedPlaceVisitDisplay(linkedPlace));
          return;
        }
      }

      if (placeKind === 'cache' && placeId != null) {
        const cacheRow = await getPlaceLookupById(placeId);
        const pois = await listPlacePoisForCache(placeId);
        if (!cancelled) {
          setDisplay(
            resolveVisitPlaceDisplay({
              placeKind: 'cache',
              placeLabel,
              poiId,
              poiLabel,
              cacheId: placeId,
              pois,
              materializedTripId,
              venueRadiusMeters:
                cacheRow?.venueRadiusMeters ?? PLACE_LOOKUP_VENUE_RADIUS_M,
            }),
          );
        }
        return;
      }

      if (!cancelled) {
        setDisplay(
          resolveVisitPlaceDisplay({
            placeLabel,
            materializedTripId,
          }),
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
  poiId: number;
  poiLabel: string;
  stay: DetectedTrip;
  dateKey: string;
  cacheId: number | null;
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

    await updateTripPoiSelection(tripId, args.poiId, args.poiLabel, cacheId);
    notifyMaterializationUpdated();
  }, []);
}

export type SetCustomVisitPlaceLabelArgs = {
  label: string;
  stay: DetectedTrip;
  dateKey: string;
  cacheId: number | null;
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

    if (cacheId == null) {
      return;
    }

    const anchor = resolveStayAnchor(args.stay);
    const poi = await insertPlacePoi({
      cacheId,
      name: trimmed,
      lat: anchor.lat,
      lng: anchor.lng,
      source: 'user',
    });

    await updateTripPoiSelection(tripId, poi.id, poi.name, cacheId);
    notifyMaterializationUpdated();
  }, []);
}
