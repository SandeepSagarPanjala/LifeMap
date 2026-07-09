import { and, asc, eq, gte, lte, sql } from 'drizzle-orm';

import { getDatabase } from '../client';
import {
  locationPoints,
  materializedDays,
  moments,
  placeLookupCache,
  placePois,
  savedPlaces,
  settings,
  trackingEvents,
  tripPoints,
  trips,
} from '../schema';
import type { ExportPeriod } from '@/lib/export-period';
import type {
  DatabaseExportTableName,
  DatabaseExportTables,
} from '@/lib/database-export';
import { estimateExportTableStorageBytes } from '@/lib/export-table-storage';
import { getDatabaseFileStats } from './storage-stats';
import { toDateKey } from '@/lib/day-utils';
import { parseMomentRefs } from '@/lib/moment-refs';

function iso(value: Date | null | undefined): string | null {
  return value ? value.toISOString() : null;
}

export async function countExportTableRows(): Promise<
  Record<DatabaseExportTableName, number>
> {
  const db = await getDatabase();
  const [
    locationPointCount,
    tripCount,
    tripPointCount,
    materializedDayCount,
    trackingEventCount,
    savedPlaceCount,
    placeLookupCount,
    placePoiCount,
    momentCount,
    settingCount,
  ] = await Promise.all([
    db.select({ count: sql<number>`count(*)` }).from(locationPoints),
    db.select({ count: sql<number>`count(*)` }).from(trips),
    db.select({ count: sql<number>`count(*)` }).from(tripPoints),
    db.select({ count: sql<number>`count(*)` }).from(materializedDays),
    db.select({ count: sql<number>`count(*)` }).from(trackingEvents),
    db.select({ count: sql<number>`count(*)` }).from(savedPlaces),
    db.select({ count: sql<number>`count(*)` }).from(placeLookupCache),
    db.select({ count: sql<number>`count(*)` }).from(placePois),
    db.select({ count: sql<number>`count(*)` }).from(moments),
    db.select({ count: sql<number>`count(*)` }).from(settings),
  ]);

  return {
    location_points: Number(locationPointCount[0]?.count ?? 0),
    trips: Number(tripCount[0]?.count ?? 0),
    trip_points: Number(tripPointCount[0]?.count ?? 0),
    materialized_days: Number(materializedDayCount[0]?.count ?? 0),
    tracking_events: Number(trackingEventCount[0]?.count ?? 0),
    saved_places: Number(savedPlaceCount[0]?.count ?? 0),
    place_lookup_cache: Number(placeLookupCount[0]?.count ?? 0),
    place_pois: Number(placePoiCount[0]?.count ?? 0),
    moments: Number(momentCount[0]?.count ?? 0),
    settings: Number(settingCount[0]?.count ?? 0),
  };
}

export type ExportTableStats = {
  counts: Record<DatabaseExportTableName, number>;
  storageBytes: Record<DatabaseExportTableName, number>;
  totalDbBytes: number;
  usedDbBytes: number;
  freeDbBytes: number;
};

export async function getExportTableStats(): Promise<ExportTableStats> {
  const [counts, fileStats] = await Promise.all([
    countExportTableRows(),
    getDatabaseFileStats(),
  ]);

  return {
    counts,
    storageBytes: estimateExportTableStorageBytes(counts, fileStats.usedBytes),
    totalDbBytes: fileStats.totalBytes,
    usedDbBytes: fileStats.usedBytes,
    freeDbBytes: fileStats.freeBytes,
  };
}

export async function fetchDatabaseExportTable(
  table: DatabaseExportTableName,
  period: ExportPeriod,
): Promise<unknown[]> {
  const tables = await fetchDatabaseExportTables(period);
  return tables[table];
}

export async function fetchDatabaseExportTables(
  period: ExportPeriod,
): Promise<DatabaseExportTables> {
  const db = await getDatabase();
  const { startAt, endAt } = period;
  const dateKey = period.dateKey;

  const [
    locationPointRows,
    tripRows,
    tripPointRows,
    materializedDayRows,
    trackingEventRows,
    savedPlaceRows,
    placeLookupRows,
    placePoiRows,
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
          .where(and(gte(trips.startAt, startAt), lte(trips.startAt, endAt)))
          .orderBy(asc(trips.startAt)),
    dateKey
      ? db
          .select({
            id: tripPoints.id,
            tripId: tripPoints.tripId,
            seq: tripPoints.seq,
            lat: tripPoints.lat,
            lng: tripPoints.lng,
            recordedAt: tripPoints.recordedAt,
            locationPointId: tripPoints.locationPointId,
            source: tripPoints.source,
            momentId: tripPoints.momentId,
          })
          .from(tripPoints)
          .innerJoin(trips, eq(tripPoints.tripId, trips.id))
          .where(eq(trips.dateKey, dateKey))
          .orderBy(asc(tripPoints.tripId), asc(tripPoints.seq))
      : period.scope === 'all'
      ? db
          .select({
            id: tripPoints.id,
            tripId: tripPoints.tripId,
            seq: tripPoints.seq,
            lat: tripPoints.lat,
            lng: tripPoints.lng,
            recordedAt: tripPoints.recordedAt,
            locationPointId: tripPoints.locationPointId,
            source: tripPoints.source,
            momentId: tripPoints.momentId,
          })
          .from(tripPoints)
          .orderBy(asc(tripPoints.tripId), asc(tripPoints.seq))
      : db
          .select({
            id: tripPoints.id,
            tripId: tripPoints.tripId,
            seq: tripPoints.seq,
            lat: tripPoints.lat,
            lng: tripPoints.lng,
            recordedAt: tripPoints.recordedAt,
            locationPointId: tripPoints.locationPointId,
            source: tripPoints.source,
            momentId: tripPoints.momentId,
          })
          .from(tripPoints)
          .innerJoin(trips, eq(tripPoints.tripId, trips.id))
          .where(and(gte(trips.startAt, startAt), lte(trips.startAt, endAt)))
          .orderBy(asc(tripPoints.tripId), asc(tripPoints.seq)),
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
    db.select().from(placePois).orderBy(asc(placePois.id)),
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
      segmentOrder: row.segmentOrder,
      placeLabel: row.placeLabel,
      placeId: row.placeId,
      placeKind: row.placeKind,
      poiId: row.poiId,
      poiLabel: row.poiLabel,
      inferred: row.inferred === 1,
      selectedCandidateIndex: row.selectedCandidateIndex,
      detectionVersion: row.detectionVersion,
      closedAt: iso(row.closedAt),
      momentRefs: parseMomentRefs(row.momentRefs),
    })),
    trip_points: tripPointRows.map(row => ({
      id: row.id,
      tripId: row.tripId,
      seq: row.seq,
      lat: row.lat,
      lng: row.lng,
      recordedAt: iso(row.recordedAt),
      locationPointId: row.locationPointId,
      source: row.source,
      momentId: row.momentId,
    })),
    materialized_days: materializedDayRows.map(row => ({
      dateKey: row.dateKey,
      status: row.status,
      detectionVersion: row.detectionVersion,
      tripCount: row.tripCount,
      pointCount: row.pointCount,
      geometryFingerprint: row.geometryFingerprint,
      sealedAt: iso(row.sealedAt),
      updatedAt: iso(row.updatedAt),
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
      addressLine: row.addressLine,
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
    place_pois: placePoiRows.map(row => ({
      id: row.id,
      cacheId: row.cacheId,
      name: row.name,
      lat: row.lat,
      lng: row.lng,
      source: row.source,
      createdAt: iso(row.createdAt),
    })),
    moments: momentRows.map(row => ({
      id: row.id,
      type: row.type,
      timestamp: iso(row.timestamp),
      finishedAt: iso(row.finishedAt),
      contentPath: row.contentPath,
      voiceAttachmentPath: row.voiceAttachmentPath,
      voiceAttachmentBytes: row.voiceAttachmentBytes,
      photoAttachmentsJson: row.photoAttachmentsJson,
      textBody: row.textBody,
      caption: row.caption,
      title: row.title,
      moodScore: row.moodScore,
      moodLabel: row.moodLabel,
      placeLabel: row.placeLabel,
      contentBytes: row.contentBytes,
      sourceBytes: row.sourceBytes,
      contentFormat: row.contentFormat,
      shareVisibility: row.shareVisibility,
      contentSyncState: row.contentSyncState,
      activityId: row.activityId,
      activityEmoji: row.activityEmoji,
      activityLabel: row.activityLabel,
    })),
    settings: settingRows.map(row => ({
      id: row.id,
      key: row.key,
      value: row.value,
    })),
  };
}
