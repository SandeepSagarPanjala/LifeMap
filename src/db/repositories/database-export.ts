import {and, asc, eq, gte, lte} from 'drizzle-orm';

import {getDatabase} from '../client';
import {
  locationPoints,
  materializationQueue,
  materializedDays,
  moments,
  placeLookupCache,
  savedPlaces,
  settings,
  trackingEvents,
  trips,
} from '../schema';
import type {ExportPeriod} from '@/lib/export-period';
import type {DatabaseExportTables} from '@/lib/database-export';
import {toDateKey} from '@/lib/day-utils';

function iso(value: Date | null | undefined): string | null {
  return value ? value.toISOString() : null;
}

export async function fetchDatabaseExportTables(
  period: ExportPeriod,
): Promise<DatabaseExportTables> {
  const db = await getDatabase();
  const {startAt, endAt} = period;
  const dateKey = period.dateKey;

  const [
    locationPointRows,
    tripRows,
    materializedDayRows,
    queueRows,
    trackingEventRows,
    savedPlaceRows,
    placeLookupRows,
    momentRows,
    settingRows,
  ] = await Promise.all([
    db
      .select()
      .from(locationPoints)
      .where(
        and(
          gte(locationPoints.timestamp, startAt),
          lte(locationPoints.timestamp, endAt),
        ),
      )
      .orderBy(asc(locationPoints.timestamp)),
    dateKey
      ? db.select().from(trips).where(eq(trips.dateKey, dateKey))
      : period.scope === 'all'
        ? db.select().from(trips).orderBy(asc(trips.startAt))
        : db
            .select()
            .from(trips)
            .where(
              and(gte(trips.startAt, startAt), lte(trips.startAt, endAt)),
            )
            .orderBy(asc(trips.startAt)),
    dateKey
      ? db
          .select()
          .from(materializedDays)
          .where(eq(materializedDays.dateKey, dateKey))
      : period.scope === 'all'
        ? db.select().from(materializedDays)
        : db
            .select()
            .from(materializedDays)
            .where(
              and(
                gte(materializedDays.dateKey, toDateKey(startAt)),
                lte(materializedDays.dateKey, toDateKey(endAt)),
              ),
            ),
    period.scope === 'all'
      ? db.select().from(materializationQueue).orderBy(asc(materializationQueue.createdAt))
      : db
          .select()
          .from(materializationQueue)
          .where(
            and(
              gte(materializationQueue.createdAt, startAt),
              lte(materializationQueue.createdAt, endAt),
            ),
          )
          .orderBy(asc(materializationQueue.createdAt)),
    db
      .select()
      .from(trackingEvents)
      .where(
        and(
          gte(trackingEvents.timestamp, startAt),
          lte(trackingEvents.timestamp, endAt),
        ),
      )
      .orderBy(asc(trackingEvents.timestamp)),
    db.select().from(savedPlaces).orderBy(asc(savedPlaces.createdAt)),
    db.select().from(placeLookupCache).orderBy(asc(placeLookupCache.id)),
    db
      .select()
      .from(moments)
      .where(
        and(gte(moments.timestamp, startAt), lte(moments.timestamp, endAt)),
      )
      .orderBy(asc(moments.timestamp)),
    db.select().from(settings).orderBy(asc(settings.key)),
  ]);

  return {
    location_points: locationPointRows.map(row => ({
      id: row.id,
      timestamp: iso(row.timestamp),
      lat: row.lat,
      lng: row.lng,
      accuracy: row.accuracy,
      altitude: row.altitude,
      speed: row.speed,
      source: row.source,
    })),
    trips: tripRows.map(row => ({
      id: row.id,
      eventKey: row.eventKey,
      kind: row.kind,
      dateKey: row.dateKey,
      startAt: iso(row.startAt),
      endAt: iso(row.endAt),
      durationMs: row.durationMs,
      distanceKm: row.distanceKm,
      centroidLat: row.centroidLat,
      centroidLng: row.centroidLng,
      placeLookupCacheId: row.placeLookupCacheId,
      selectedCandidateIndex: row.selectedCandidateIndex,
      detectionVersion: row.detectionVersion,
      closedAt: iso(row.closedAt),
    })),
    materialized_days: materializedDayRows.map(row => ({
      dateKey: row.dateKey,
      status: row.status,
      detectionVersion: row.detectionVersion,
      tripCount: row.tripCount,
      pointCount: row.pointCount,
      sealedAt: iso(row.sealedAt),
      updatedAt: iso(row.updatedAt),
    })),
    materialization_queue: queueRows.map(row => ({
      id: row.id,
      jobType: row.jobType,
      dateKey: row.dateKey,
      status: row.status,
      attempts: row.attempts,
      createdAt: iso(row.createdAt),
    })),
    tracking_events: trackingEventRows.map(row => ({
      id: row.id,
      timestamp: iso(row.timestamp),
      event: row.event,
      details: row.details,
    })),
    saved_places: savedPlaceRows.map(row => ({
      id: row.id,
      kind: row.kind,
      label: row.label,
      lat: row.lat,
      lng: row.lng,
      radiusMeters: row.radiusMeters,
      createdAt: iso(row.createdAt),
    })),
    place_lookup_cache: placeLookupRows.map(row => ({
      id: row.id,
      anchorLat: row.anchorLat,
      anchorLng: row.anchorLng,
      venueRadiusMeters: row.venueRadiusMeters,
      addressLine: row.addressLine,
      candidatesJson: row.candidatesJson,
      selectedCandidateIndex: row.selectedCandidateIndex,
      lookupStatus: row.lookupStatus,
      fetchedAt: iso(row.fetchedAt),
    })),
    moments: momentRows.map(row => ({
      id: row.id,
      type: row.type,
      timestamp: iso(row.timestamp),
      lat: row.lat,
      lng: row.lng,
      contentPath: row.contentPath,
      textBody: row.textBody,
      caption: row.caption,
      placeLabel: row.placeLabel,
      linkedPointId: row.linkedPointId,
      shareVisibility: row.shareVisibility,
      contentSyncState: row.contentSyncState,
    })),
    settings: settingRows.map(row => ({
      id: row.id,
      key: row.key,
      value: row.value,
    })),
  };
}
