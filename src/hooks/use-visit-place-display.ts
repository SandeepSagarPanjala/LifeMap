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
import { upsertVisitLabelOverride } from '@/db/repositories/visit-label-overrides';
import {
  getSavedPlaceById,
  type SavedPlaceRow,
} from '@/db/repositories/saved-places';
import { toDateKey } from '@/lib/day-utils';
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
import {
  loadVisitLabelOverrideForStay,
  shouldApplyVisitLabelOverride,
  visitLabelOverrideToResolved,
} from '@/lib/visit-label-override';

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

async function applyOverrideIfNeeded(
  stay: DetectedTrip,
  fields: {
    materializedTripId: number | null;
    placeLabel: string | null;
    placeId: number | null;
    placeKind: 'saved' | 'cache' | null;
    poiId: number | null;
    poiLabel: string | null;
  },
): Promise<{
  materializedTripId: number | null;
  placeLabel: string | null;
  placeId: number | null;
  placeKind: 'saved' | 'cache' | null;
  poiId: number | null;
  poiLabel: string | null;
}> {
  if (
    !shouldApplyVisitLabelOverride({
      materializedTripId: fields.materializedTripId,
      poiId: fields.poiId,
      openThroughNow: stay.openThroughNow,
    })
  ) {
    return fields;
  }

  const dateKey = toDateKey(stay.startAt);
  const override = await loadVisitLabelOverrideForStay(dateKey, stay.startAt);
  if (!override) {
    return fields;
  }

  const resolved = visitLabelOverrideToResolved(override, {
    placeLabel: fields.placeLabel,
    placeId: fields.placeId,
    placeKind: fields.placeKind,
    poiId: fields.poiId,
    poiLabel: fields.poiLabel,
    poiCategory: null,
  });

  return {
    ...fields,
    placeLabel: resolved.placeLabel,
    placeId: resolved.placeId,
    placeKind: resolved.placeKind,
    poiId: resolved.poiId,
    poiLabel: resolved.poiLabel,
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

      const withOverride = await applyOverrideIfNeeded(stay, {
        materializedTripId,
        placeLabel,
        placeId,
        placeKind,
        poiId,
        poiLabel,
      });
      materializedTripId = withOverride.materializedTripId;
      placeLabel = withOverride.placeLabel;
      placeId = withOverride.placeId;
      placeKind = withOverride.placeKind;
      poiId = withOverride.poiId;
      poiLabel = withOverride.poiLabel;

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

function resolveCacheIdForSelection(args: {
  cacheId: number | null;
  stay: DetectedTrip;
  tripPlaceId: number | null;
  tripPlaceKind: 'saved' | 'cache' | null;
}): number | null {
  return (
    args.cacheId ??
    (args.tripPlaceKind === 'cache' ? args.tripPlaceId : null) ??
    (args.stay.placeKind === 'cache' ? args.stay.placeId ?? null : null)
  );
}

async function persistVisitPlacePoiSelection(args: {
  stay: DetectedTrip;
  dateKey: string;
  poiId: number;
  poiLabel: string;
  cacheId: number | null;
  materializedTripId?: number | null;
}): Promise<void> {
  const trip = await ensureTripForClosedStay(args.stay, args.dateKey);
  const tripId = trip?.id ?? args.materializedTripId ?? null;
  const resolved = trip != null ? resolvedPlaceFromTripRow(trip) : null;
  const cacheId = resolveCacheIdForSelection({
    cacheId: args.cacheId,
    stay: args.stay,
    tripPlaceId: resolved?.placeId ?? null,
    tripPlaceKind: resolved?.placeKind ?? null,
  });

  // Always write override so silent-seal prune of early-inserted tail rows
  // cannot erase the user's pick before the visit is truly sealed.
  await upsertVisitLabelOverride({
    dateKey: args.dateKey,
    startAtMs: args.stay.startAt.getTime(),
    poiId: args.poiId,
    poiLabel: args.poiLabel,
    placeId: cacheId,
    placeKind: cacheId != null ? 'cache' : null,
  });

  if (tripId != null) {
    await updateTripPoiSelection(tripId, args.poiId, args.poiLabel, cacheId);
  }

  notifyMaterializationUpdated();
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
    await persistVisitPlacePoiSelection({
      stay: args.stay,
      dateKey: args.dateKey,
      poiId: args.poiId,
      poiLabel: args.poiLabel,
      cacheId: args.cacheId,
      materializedTripId: args.materializedTripId,
    });
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
    const resolved = trip != null ? resolvedPlaceFromTripRow(trip) : null;
    const cacheId = resolveCacheIdForSelection({
      cacheId: args.cacheId,
      stay: args.stay,
      tripPlaceId: resolved?.placeId ?? null,
      tripPlaceKind: resolved?.placeKind ?? null,
    });

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

    await persistVisitPlacePoiSelection({
      stay: args.stay,
      dateKey: args.dateKey,
      poiId: poi.id,
      poiLabel: poi.name,
      cacheId,
      materializedTripId: args.materializedTripId ?? trip?.id ?? null,
    });
  }, []);
}
