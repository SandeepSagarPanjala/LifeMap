import { listSavedPlaces } from '@/db/repositories/saved-places';
import {
  findPlaceLookupNearAnchor,
  listPlaceLookupCacheRows,
} from '@/db/repositories/place-lookup-cache';
import { listTripsForDay, type TripRow } from '@/db/repositories/trips';
import { getCurrentOpenVisit } from '@/lib/today-history';
import {
  stayQualifiesForPlaceLookup,
  shouldSkipPlaceLookupForStay,
} from '@/lib/place-lookup-service';
import { matchSavedPlaceForStay } from '@/lib/saved-places';
import {
  findNearestPlaceLookupMatch,
  isWithinPlaceLookupVenue,
} from '@/lib/place-lookup-venue';
import type { PlaceLookupRow } from '@/lib/place-lookup-types';
import type { DayTimelineEntry } from '@/lib/trip-detection';
import type { TripDetectionConfig } from '@/lib/trip-settings';
import {
  delayBetweenPlaceCacheItems,
  runPlaceCacheWorkItem,
} from '@/lib/place-cache-work';

export type PlaceCacheTripWork = {
  kind: 'trip';
  tripId: number;
  eventKey: string;
  dateKey: string;
};

export type PlaceCacheOpenVisitWork = {
  kind: 'open_visit';
  stayId: string;
  dateKey: string;
  anchor: { lat: number; lng: number };
};

export type PlaceCacheWorkItem = PlaceCacheTripWork | PlaceCacheOpenVisitWork;

export function tripNeedsPlaceCache(trip: TripRow): boolean {
  if (trip.kind !== 'stay') {
    return false;
  }
  if (trip.placeId != null || trip.poiId != null) {
    return false;
  }
  if (trip.placeLabel?.trim()) {
    return false;
  }
  return true;
}

/** Unlabeled sealed stays for one day — skip anchors that already failed MapKit. */
export async function buildPlaceCacheItemsForDate(
  dateKey: string,
): Promise<PlaceCacheTripWork[]> {
  const rows = await listTripsForDay(dateKey);
  const cacheRows = await listPlaceLookupCacheRows();
  const items: PlaceCacheTripWork[] = [];
  for (const row of rows) {
    if (!tripNeedsPlaceCache(row)) {
      continue;
    }
    const cache = findNearestPlaceLookupMatch(
      { lat: row.centroidLat, lng: row.centroidLng },
      cacheRows,
    );
    if (cache?.lookupStatus === 'failed') {
      continue;
    }
    items.push({
      kind: 'trip',
      tripId: row.id,
      eventKey: row.eventKey,
      dateKey: row.dateKey,
    });
  }
  return items;
}

/** Open visit from an already-built timeline (no second today detect). */
export async function buildOpenVisitPlaceCacheItemFromEntries(
  entries: readonly DayTimelineEntry[],
  dateKey: string,
  config: TripDetectionConfig,
): Promise<PlaceCacheOpenVisitWork | null> {
  const savedPlaces = await listSavedPlaces();
  const openVisit = getCurrentOpenVisit([...entries], { config });
  if (openVisit == null) {
    return null;
  }
  if (matchSavedPlaceForStay(openVisit, savedPlaces)) {
    return null;
  }
  if (
    !stayQualifiesForPlaceLookup(openVisit, config, savedPlaces) ||
    shouldSkipPlaceLookupForStay(openVisit, savedPlaces)
  ) {
    return null;
  }
  const lat = openVisit.anchorLat ?? openVisit.points[0]?.lat;
  const lng = openVisit.anchorLng ?? openVisit.points[0]?.lng;
  if (
    lat == null ||
    lng == null ||
    !Number.isFinite(lat) ||
    !Number.isFinite(lng)
  ) {
    return null;
  }
  const anchor = { lat, lng };
  const cache = await findPlaceLookupNearAnchor(anchor);
  if (cache?.lookupStatus === 'complete' || cache?.lookupStatus === 'failed') {
    return null;
  }
  return {
    kind: 'open_visit',
    stayId: openVisit.id,
    dateKey,
    anchor,
  };
}

export async function runPlaceCacheForItems(
  items: readonly PlaceCacheWorkItem[],
): Promise<void> {
  for (const item of items) {
    await runPlaceCacheWorkItem(item);
    await delayBetweenPlaceCacheItems();
  }
}

/**
 * Place lookups for stays on a day (and optional open visit from known entries).
 * Call after seal / today display merge — no global trips scan.
 */
export async function runPlaceCacheForDate(
  dateKey: string,
  options?: {
    openVisitEntries?: readonly DayTimelineEntry[];
    detectionConfig?: TripDetectionConfig;
  },
): Promise<number> {
  const items: PlaceCacheWorkItem[] =
    await buildPlaceCacheItemsForDate(dateKey);
  if (
    options?.openVisitEntries != null &&
    options.detectionConfig != null
  ) {
    const openVisit = await buildOpenVisitPlaceCacheItemFromEntries(
      options.openVisitEntries,
      dateKey,
      options.detectionConfig,
    );
    if (openVisit != null) {
      items.push(openVisit);
    }
  }
  if (items.length === 0) {
    return 0;
  }
  await runPlaceCacheForItems(items);
  return items.length;
}

export async function openVisitHasCompleteCache(anchor: {
  lat: number;
  lng: number;
}): Promise<PlaceLookupRow | null> {
  const cache = await findPlaceLookupNearAnchor(anchor);
  if (cache?.lookupStatus === 'complete') {
    return cache;
  }
  return null;
}

export function anchorCoveredByCache(
  anchor: { lat: number; lng: number },
  cache: PlaceLookupRow,
): boolean {
  return isWithinPlaceLookupVenue(
    anchor,
    { lat: cache.anchorLat, lng: cache.anchorLng },
    cache.venueRadiusMeters,
  );
}
