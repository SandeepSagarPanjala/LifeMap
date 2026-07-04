/**
 * Background place-lookup backfill for sealed stays with no label.
 *
 * Not wired into the app yet — see README § Place lookup backfill.
 */

import {DEFAULT_PLACE_LOOKUP_BACKFILL_BATCH_SIZE} from '@/lib/app-constants';
import {findPlaceLookupNearAnchor} from '@/db/repositories/place-lookup-cache';
import type {SavedPlaceRow} from '@/db/repositories/saved-places';
import {
  applyTripPersistedLabel,
  listAllTrips,
  type TripRow,
} from '@/db/repositories/trips';
import {
  enqueuePlaceLookupForStay,
  shouldSkipPlaceLookupForStay,
  stayQualifiesForPlaceLookup,
} from '@/lib/place-lookup-service';
import type {PlaceLookupRow} from '@/lib/place-lookup-types';
import {
  existingTripLabelsByEventKey,
  getDefaultTripDetectionConfig,
  tripLabelForPersist,
  type PersistedTripLabel,
} from '@/lib/trip-materialization';
import {resolvedPlaceFromTripRow} from '@/lib/resolved-place';
import type {DetectedTrip} from '@/lib/trip-detection';
import type {TripDetectionConfig} from '@/lib/trip-settings';

export type PlaceLookupBackfillOptions = {
  /** Max stays to process this batch (default 3). */
  maxTrips?: number;
  tripConfig?: TripDetectionConfig;
  savedPlaces?: readonly SavedPlaceRow[];
  /** User labels keyed by eventKey — survives day re-materialization. */
  existingLabelsByEventKey?: ReadonlyMap<string, PersistedTripLabel>;
  /** When omitted, scans all persisted trips. */
  trips?: readonly TripRow[];
};

export type PlaceLookupBackfillTripStatus =
  | 'linked_cache'
  | 'fetched'
  | 'skipped'
  | 'still_pending';

export type PlaceLookupBackfillTripResult = {
  eventKey: string;
  tripId: number;
  status: PlaceLookupBackfillTripStatus;
  placeId: number | null;
};

export type PlaceLookupBackfillBatchResult = {
  processed: number;
  results: PlaceLookupBackfillTripResult[];
  remaining: number;
};

/** Stay anchor for lookup — sealed trip centroid, not raw GPS rescan. */
export function tripLookupAnchorFromRow(
  trip: TripRow,
): {lat: number; lng: number} {
  return {lat: trip.centroidLat, lng: trip.centroidLng};
}

export function isStayMissingPlaceLabel(trip: TripRow): boolean {
  if (trip.kind !== 'stay') {
    return false;
  }
  if (trip.placeId != null) {
    return false;
  }
  if (trip.selectedCandidateIndex != null) {
    return false;
  }
  if (trip.placeLabel?.trim()) {
    return false;
  }
  return true;
}

export function tripRowToBackfillStay(trip: TripRow): DetectedTrip {
  const resolved = resolvedPlaceFromTripRow(trip);
  return {
    id: trip.eventKey,
    kind: 'stay',
    points: [
      {
        id: trip.id,
        timestamp: trip.startAt,
        lat: trip.centroidLat,
        lng: trip.centroidLng,
        accuracy: 10,
        altitude: null,
        speed: null,
        source: 'backfill',
      },
    ],
    startAt: trip.startAt,
    endAt: trip.endAt,
    durationMs: trip.durationMs,
    distanceKm: trip.distanceKm,
    materializedTripId: trip.id,
    anchorLat: trip.centroidLat,
    anchorLng: trip.centroidLng,
    placeLabel: resolved.placeLabel ?? undefined,
    placeId: resolved.placeId ?? undefined,
    placeKind: resolved.placeKind ?? undefined,
  };
}

export function listStaysNeedingPlaceLookup(
  trips: readonly TripRow[],
  config: TripDetectionConfig,
  savedPlaces: readonly SavedPlaceRow[] = [],
): TripRow[] {
  return trips.filter(trip => {
    if (!isStayMissingPlaceLabel(trip)) {
      return false;
    }
    const stay = tripRowToBackfillStay(trip);
    return (
      stayQualifiesForPlaceLookup(stay, config, savedPlaces) &&
      !shouldSkipPlaceLookupForStay(stay, savedPlaces)
    );
  });
}

/** Merge cache hit with user labels by stable eventKey (rebuild-safe). */
export function mergeTripPlaceLabelAfterLookup(
  eventKey: string,
  existingByEventKey: ReadonlyMap<string, PersistedTripLabel>,
  placeLookup: PlaceLookupRow | null,
  detected?: {
    placeLabel?: string | null;
    placeId?: number | null;
    placeKind?: DetectedTrip['placeKind'] | null;
  },
): PersistedTripLabel {
  if (placeLookup != null) {
    return tripLabelForPersist(eventKey, existingByEventKey, {
      placeKind: 'cache',
      placeId: placeLookup.id,
      placeLabel: detected?.placeLabel ?? null,
      selectedCandidateIndex: placeLookup.selectedCandidateIndex,
    });
  }

  if (detected?.placeKind != null) {
    return tripLabelForPersist(eventKey, existingByEventKey, {
      placeLabel: detected.placeLabel ?? null,
      placeId: detected.placeId ?? null,
      placeKind: detected.placeKind,
    });
  }

  return tripLabelForPersist(eventKey, existingByEventKey);
}

export async function backfillPlaceLookupForStay(
  trip: TripRow,
  options: {
    config: TripDetectionConfig;
    savedPlaces: readonly SavedPlaceRow[];
    existingByEventKey: ReadonlyMap<string, PersistedTripLabel>;
  },
): Promise<PlaceLookupBackfillTripResult> {
  const base = {
    eventKey: trip.eventKey,
    tripId: trip.id,
    placeId: trip.placeId,
  };

  if (!isStayMissingPlaceLabel(trip)) {
    return {...base, status: 'skipped'};
  }

  const stay = tripRowToBackfillStay(trip);
  if (
    !stayQualifiesForPlaceLookup(stay, options.config, options.savedPlaces) ||
    shouldSkipPlaceLookupForStay(stay, options.savedPlaces)
  ) {
    return {...base, status: 'skipped'};
  }

  const anchor = tripLookupAnchorFromRow(trip);
  let cache = await findPlaceLookupNearAnchor(anchor);
  let fetched = false;

  if (cache?.lookupStatus !== 'complete') {
    await enqueuePlaceLookupForStay(
      stay,
      [...options.savedPlaces],
      options.config,
    );
    fetched = true;
    cache = await findPlaceLookupNearAnchor(anchor);
  }

  if (cache?.lookupStatus !== 'complete') {
    return {
      ...base,
      status: cache?.lookupStatus === 'pending' ? 'still_pending' : 'skipped',
      placeId: null,
    };
  }

  const labels = mergeTripPlaceLabelAfterLookup(
    trip.eventKey,
    options.existingByEventKey,
    cache,
    resolvedPlaceFromTripRow(trip),
  );
  await applyTripPersistedLabel(trip.id, labels);

  return {
    eventKey: trip.eventKey,
    tripId: trip.id,
    status: fetched ? 'fetched' : 'linked_cache',
    placeId: cache.id,
  };
}

/**
 * Steady background backfill: link or fetch place lookup for up to N unlabeled stays.
 */
export async function runPlaceLookupBackfillBatch(
  options: PlaceLookupBackfillOptions = {},
): Promise<PlaceLookupBackfillBatchResult> {
  const maxTrips =
    options.maxTrips ?? DEFAULT_PLACE_LOOKUP_BACKFILL_BATCH_SIZE;
  const config = options.tripConfig ?? getDefaultTripDetectionConfig();
  const savedPlaces = options.savedPlaces ?? [];

  const allTrips = options.trips ?? (await listAllTrips());
  const existingByEventKey =
    options.existingLabelsByEventKey ??
    existingTripLabelsByEventKey(allTrips);

  const candidates = listStaysNeedingPlaceLookup(
    allTrips,
    config,
    savedPlaces,
  );
  const batch = candidates.slice(0, maxTrips);

  const results: PlaceLookupBackfillTripResult[] = [];
  for (const trip of batch) {
    results.push(
      await backfillPlaceLookupForStay(trip, {
        config,
        savedPlaces,
        existingByEventKey,
      }),
    );
  }

  return {
    processed: results.length,
    results,
    remaining: Math.max(0, candidates.length - batch.length),
  };
}
