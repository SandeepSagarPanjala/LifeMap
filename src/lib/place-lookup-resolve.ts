import {
  closestPlacePoiToAnchor,
  listPlacePoisForCache,
} from '@/db/repositories/place-pois';
import {
  listSavedPlaces,
  type SavedPlaceRow,
} from '@/db/repositories/saved-places';
import { applyTripPersistedLabel, type TripRow } from '@/db/repositories/trips';
import {
  mergeTripPlaceLabelAfterLookup,
  tripLookupAnchorFromRow,
  tripRowToBackfillStay,
  isStayMissingPlaceLabel,
} from '@/lib/place-lookup-backfill';
import {
  ensureCompletePlaceLookupAtAnchor,
  platformResolvesClosestPoi,
  shouldSkipPlaceLookupForStay,
  stayQualifiesForPlaceLookup,
} from '@/lib/place-lookup-service';
import { notifyPlaceLookupUpdated } from '@/lib/place-lookup-events';
import { matchSavedPlaceForStay } from '@/lib/saved-places';
import type { DetectedTrip } from '@/lib/trip-detection';
import {
  ensureTripForClosedStay,
  existingTripLabelsByEventKey,
  getDefaultTripDetectionConfig,
  type PersistedTripLabel,
} from '@/lib/trip-materialization';
import { notifyMaterializationUpdated } from '@/lib/trip-materialization-events';
import type { TripDetectionConfig } from '@/lib/trip-settings';

export function stayNeedsLazyPlaceLookup(
  stay: DetectedTrip,
  savedPlaces: readonly SavedPlaceRow[],
): boolean {
  if (stay.openThroughNow) {
    return false;
  }
  if (matchSavedPlaceForStay(stay, savedPlaces)) {
    return false;
  }
  if (shouldSkipPlaceLookupForStay(stay, savedPlaces)) {
    return false;
  }
  if (stay.placeKind === 'cache' && stay.placeId != null) {
    return false;
  }
  if (stay.poiId != null) {
    return false;
  }
  if (stay.placeLabel?.trim()) {
    return false;
  }
  return true;
}

async function resolveClosestPoiForCache(
  cacheId: number,
  anchor: { lat: number; lng: number },
): Promise<{ poiId: number; poiLabel: string } | null> {
  if (!platformResolvesClosestPoi()) {
    return null;
  }
  const pois = await listPlacePoisForCache(cacheId);
  const closest = closestPlacePoiToAnchor(anchor, pois);
  if (closest == null) {
    return null;
  }
  return { poiId: closest.id, poiLabel: closest.name };
}

export type ResolvePlaceLabelResult =
  | 'linked_cache'
  | 'fetched'
  | 'skipped'
  | 'failed';

export async function resolveAndPersistPlaceLabelForTripRow(
  trip: TripRow,
  options: {
    config: TripDetectionConfig;
    savedPlaces: readonly SavedPlaceRow[];
    existingByEventKey: ReadonlyMap<string, PersistedTripLabel>;
    bypassSessionBudget?: boolean;
  },
): Promise<ResolvePlaceLabelResult> {
  if (!isStayMissingPlaceLabel(trip)) {
    return 'skipped';
  }

  const stay = tripRowToBackfillStay(trip);
  if (
    !stayQualifiesForPlaceLookup(stay, options.config, options.savedPlaces) ||
    shouldSkipPlaceLookupForStay(stay, options.savedPlaces)
  ) {
    return 'skipped';
  }

  const anchor = tripLookupAnchorFromRow(trip);
  const cache = await ensureCompletePlaceLookupAtAnchor(anchor, {
    bypassSessionBudget: options.bypassSessionBudget,
  });
  if (cache == null) {
    return 'failed';
  }

  const closestPoi = await resolveClosestPoiForCache(cache.id, anchor);
  const labels = mergeTripPlaceLabelAfterLookup(
    trip.eventKey,
    options.existingByEventKey,
    cache,
    closestPoi ?? undefined,
  );
  await applyTripPersistedLabel(trip.id, labels);
  notifyMaterializationUpdated();
  notifyPlaceLookupUpdated();

  const hadCache = trip.placeKind === 'cache' && trip.placeId === cache.id;
  return hadCache ? 'linked_cache' : 'fetched';
}

export async function resolveAndPersistPlaceLabelForStay(
  stay: DetectedTrip,
  dateKey: string,
  options?: {
    config?: TripDetectionConfig;
    savedPlaces?: readonly SavedPlaceRow[];
    existingByEventKey?: ReadonlyMap<string, PersistedTripLabel>;
    bypassSessionBudget?: boolean;
  },
): Promise<boolean> {
  const config = options?.config ?? getDefaultTripDetectionConfig();
  const savedPlaces = options?.savedPlaces ?? (await listSavedPlaces());

  if (!stayNeedsLazyPlaceLookup(stay, savedPlaces)) {
    return false;
  }
  if (
    !stayQualifiesForPlaceLookup(stay, config, savedPlaces) ||
    shouldSkipPlaceLookupForStay(stay, savedPlaces)
  ) {
    return false;
  }

  const trip = await ensureTripForClosedStay(stay, dateKey);
  if (trip == null) {
    return false;
  }

  const existingByEventKey =
    options?.existingByEventKey ?? existingTripLabelsByEventKey([trip]);

  const result = await resolveAndPersistPlaceLabelForTripRow(trip, {
    config,
    savedPlaces,
    existingByEventKey,
    bypassSessionBudget: options?.bypassSessionBudget ?? true,
  });

  return result === 'fetched' || result === 'linked_cache';
}
