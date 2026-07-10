import { and, eq, isNull, or, sql } from 'drizzle-orm';

import { getTripById, type TripRow } from '@/db/repositories/trips';
import { listSavedPlaces } from '@/db/repositories/saved-places';
import { findPlaceLookupNearAnchor } from '@/db/repositories/place-lookup-cache';
import { getTodayDateKey } from '@/lib/day-utils';
import { buildTodayDisplayHistory } from '@/lib/today-live-history';
import { getCurrentOpenVisit } from '@/lib/today-history';
import { getDefaultTripDetectionConfig } from '@/lib/trip-materialization';
import {
  stayQualifiesForPlaceLookup,
  shouldSkipPlaceLookupForStay,
} from '@/lib/place-lookup-service';
import { matchSavedPlaceForStay } from '@/lib/saved-places';
import { isWithinPlaceLookupVenue } from '@/lib/place-lookup-venue';
import type { PlaceLookupRow } from '@/lib/place-lookup-types';
import { listTripsForDay } from '@/db/repositories/trips';
import { getDatabase } from '@/db/client';
import { trips } from '@/db/schema';

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

function unlabeledStayTripConditions() {
  return and(
    eq(trips.kind, 'stay'),
    isNull(trips.placeId),
    isNull(trips.poiId),
    or(isNull(trips.placeLabel), eq(trips.placeLabel, '')),
  );
}

export async function hasPlaceCacheBacklog(): Promise<boolean> {
  const db = await getDatabase();
  const rows = await db
    .select({ id: trips.id })
    .from(trips)
    .where(unlabeledStayTripConditions())
    .limit(1);
  if (rows.length > 0) {
    return true;
  }
  const openVisit = await detectOpenVisitNeedingPlaceCache();
  return openVisit != null;
}

export async function listUnlabeledStayTripIds(): Promise<number[]> {
  const db = await getDatabase();
  const rows = await db
    .select({ id: trips.id })
    .from(trips)
    .where(unlabeledStayTripConditions())
    .orderBy(sql`${trips.dateKey} asc`, sql`${trips.startAt} asc`);
  return rows.map(row => row.id);
}

async function detectOpenVisitNeedingPlaceCache(): Promise<PlaceCacheOpenVisitWork | null> {
  const dateKey = getTodayDateKey();
  const config = getDefaultTripDetectionConfig();
  const savedPlaces = await listSavedPlaces();
  const todayTrips = await listTripsForDay(dateKey);
  const history = await buildTodayDisplayHistory(
    dateKey,
    config,
    new Date(),
    todayTrips,
  );
  const openVisit = getCurrentOpenVisit(history.entries, { config });
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
  const anchor = {
    lat: openVisit.anchorLat ?? openVisit.points[0]?.lat ?? 0,
    lng: openVisit.anchorLng ?? openVisit.points[0]?.lng ?? 0,
  };
  if (!Number.isFinite(anchor.lat) || !Number.isFinite(anchor.lng)) {
    return null;
  }
  const cache = await findPlaceLookupNearAnchor(anchor);
  if (cache?.lookupStatus === 'complete') {
    return null;
  }
  return {
    kind: 'open_visit',
    stayId: openVisit.id,
    dateKey,
    anchor,
  };
}

export async function buildPlaceCacheWorkQueue(): Promise<PlaceCacheWorkItem[]> {
  const tripIds = await listUnlabeledStayTripIds();
  const items: PlaceCacheWorkItem[] = tripIds.map(tripId => ({
    kind: 'trip',
    tripId,
    eventKey: '',
    dateKey: '',
  }));

  for (let index = 0; index < items.length; index += 1) {
    const item = items[index]!;
    if (item.kind !== 'trip') {
      continue;
    }
    const trip = await getTripById(item.tripId);
    if (trip == null) {
      continue;
    }
    items[index] = {
      kind: 'trip',
      tripId: trip.id,
      eventKey: trip.eventKey,
      dateKey: trip.dateKey,
    };
  }

  const openVisit = await detectOpenVisitNeedingPlaceCache();
  if (openVisit != null) {
    items.push(openVisit);
  }

  return items.filter(item => item.kind !== 'trip' || item.eventKey.length > 0);
}

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
