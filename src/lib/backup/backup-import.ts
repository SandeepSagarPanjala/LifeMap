import {getDatabase} from '@/db/client';
import {
  activities,
  locationPoints,
  moments,
  placeLookupCache,
  savedPlaces,
  settings,
} from '@/db/schema';
import {
  getTripByEventKey,
  updateTripCustomLabel,
  updateTripLabelSelection,
  updateTripSavedPlaceAssociation,
} from '@/db/repositories/trips';
import {
  getDefaultTripDetectionConfig,
  rebuildAllTrips,
} from '@/lib/trip-materialization';

import type {BackupBundleTables} from './backup-export';
import {
  parseIsoDate,
  parseOptionalNumber,
  parseOptionalString,
  parseRequiredIsoDate,
  parseRequiredNumber,
  parseRequiredString,
} from './backup-serialize';
import type {BackupProgress, TripLabelOverride} from './backup-types';

type IdMap = Map<number, number>;

function remapId(
  value: number | null | undefined,
  map: IdMap,
): number | null {
  if (value == null) {
    return null;
  }
  return map.get(value) ?? null;
}

async function importActivities(rows: unknown[]): Promise<IdMap> {
  const db = await getDatabase();
  const map: IdMap = new Map();

  for (const row of rows) {
    if (typeof row !== 'object' || row == null) {
      continue;
    }
    const record = row as Record<string, unknown>;
    const oldId = parseRequiredNumber(record.id, 'activities.id');
    const inserted = await db
      .insert(activities)
      .values({
        emoji: parseRequiredString(record.emoji, 'activities.emoji'),
        label: parseRequiredString(record.label, 'activities.label'),
        sortOrder: parseRequiredNumber(record.sortOrder, 'activities.sortOrder'),
        createdAt: parseRequiredIsoDate(record.createdAt, 'activities.createdAt'),
        archivedAt: parseIsoDate(record.archivedAt),
      })
      .returning({id: activities.id});
    map.set(oldId, inserted[0]!.id);
  }

  return map;
}

async function importLocationPoints(rows: unknown[]): Promise<IdMap> {
  const db = await getDatabase();
  const map: IdMap = new Map();

  for (const row of rows) {
    if (typeof row !== 'object' || row == null) {
      continue;
    }
    const record = row as Record<string, unknown>;
    const oldId = parseRequiredNumber(record.id, 'location_points.id');
    const inserted = await db
      .insert(locationPoints)
      .values({
        timestamp: parseRequiredIsoDate(
          record.timestamp,
          'location_points.timestamp',
        ),
        lat: parseRequiredNumber(record.lat, 'location_points.lat'),
        lng: parseRequiredNumber(record.lng, 'location_points.lng'),
        accuracy: parseOptionalNumber(record.accuracy),
        altitude: parseOptionalNumber(record.altitude),
        speed: parseOptionalNumber(record.speed),
        source: parseRequiredString(record.source, 'location_points.source'),
      })
      .returning({id: locationPoints.id});
    map.set(oldId, inserted[0]!.id);
  }

  return map;
}

async function importSavedPlaces(rows: unknown[]): Promise<IdMap> {
  const db = await getDatabase();
  const map: IdMap = new Map();

  for (const row of rows) {
    if (typeof row !== 'object' || row == null) {
      continue;
    }
    const record = row as Record<string, unknown>;
    const oldId = parseRequiredNumber(record.id, 'saved_places.id');
    const kind = parseRequiredString(record.kind, 'saved_places.kind');
    if (kind !== 'home' && kind !== 'work' && kind !== 'favorite') {
      throw new Error(`Unsupported saved place kind: ${kind}`);
    }
    const inserted = await db
      .insert(savedPlaces)
      .values({
        kind,
        label: parseRequiredString(record.label, 'saved_places.label'),
        lat: parseRequiredNumber(record.lat, 'saved_places.lat'),
        lng: parseRequiredNumber(record.lng, 'saved_places.lng'),
        radiusMeters: parseRequiredNumber(
          record.radiusMeters,
          'saved_places.radiusMeters',
        ),
        addressLine: parseOptionalString(record.addressLine),
        active:
          typeof record.active === 'number'
            ? record.active
            : record.active === false
              ? 0
              : 1,
        createdAt: parseRequiredIsoDate(record.createdAt, 'saved_places.createdAt'),
      })
      .returning({id: savedPlaces.id});
    map.set(oldId, inserted[0]!.id);
  }

  return map;
}

async function importPlaceLookupCache(rows: unknown[]): Promise<IdMap> {
  const db = await getDatabase();
  const map: IdMap = new Map();

  for (const row of rows) {
    if (typeof row !== 'object' || row == null) {
      continue;
    }
    const record = row as Record<string, unknown>;
    const oldId = parseRequiredNumber(record.id, 'place_lookup_cache.id');
    const inserted = await db
      .insert(placeLookupCache)
      .values({
        anchorLat: parseRequiredNumber(record.anchorLat, 'place_lookup_cache.anchorLat'),
        anchorLng: parseRequiredNumber(record.anchorLng, 'place_lookup_cache.anchorLng'),
        venueRadiusMeters: parseRequiredNumber(
          record.venueRadiusMeters,
          'place_lookup_cache.venueRadiusMeters',
        ),
        addressLine: parseOptionalString(record.addressLine),
        candidatesJson: parseOptionalString(record.candidatesJson),
        selectedCandidateIndex: parseOptionalNumber(record.selectedCandidateIndex),
        lookupStatus: parseRequiredString(
          record.lookupStatus,
          'place_lookup_cache.lookupStatus',
        ),
        fetchedAt: parseIsoDate(record.fetchedAt),
      })
      .returning({id: placeLookupCache.id});
    map.set(oldId, inserted[0]!.id);
  }

  return map;
}

const MOMENT_TYPES = new Set([
  'photo',
  'note',
  'video',
  'voice',
  'activity',
]);

async function importMoments(
  rows: unknown[],
  locationPointMap: IdMap,
  activityMap: IdMap,
): Promise<void> {
  const db = await getDatabase();

  for (const row of rows) {
    if (typeof row !== 'object' || row == null) {
      continue;
    }
    const record = row as Record<string, unknown>;
    const type = parseRequiredString(record.type, 'moments.type');
    if (!MOMENT_TYPES.has(type)) {
      throw new Error(`Unsupported moment type: ${type}`);
    }

    await db.insert(moments).values({
      type: type as 'photo' | 'note' | 'video' | 'voice' | 'activity',
      timestamp: parseRequiredIsoDate(record.timestamp, 'moments.timestamp'),
      finishedAt: parseIsoDate(record.finishedAt),
      lat: parseOptionalNumber(record.lat),
      lng: parseOptionalNumber(record.lng),
      contentPath: parseOptionalString(record.contentPath),
      voiceAttachmentPath: parseOptionalString(record.voiceAttachmentPath),
      voiceAttachmentBytes: parseOptionalNumber(record.voiceAttachmentBytes),
      voiceDurationSec: parseOptionalNumber(record.voiceDurationSec),
      photoAttachmentsJson:
        typeof record.photoAttachmentsJson === 'string'
          ? record.photoAttachmentsJson
          : null,
      textBody: parseOptionalString(record.textBody),
      caption: parseOptionalString(record.caption),
      title: parseOptionalString(record.title),
      moodScore: parseOptionalNumber(record.moodScore),
      moodLabel: parseOptionalString(record.moodLabel),
      placeLabel: parseOptionalString(record.placeLabel),
      linkedPointId: remapId(
        parseOptionalNumber(record.linkedPointId),
        locationPointMap,
      ),
      contentBytes: parseOptionalNumber(record.contentBytes),
      sourceBytes: parseOptionalNumber(record.sourceBytes),
      contentFormat: parseOptionalString(record.contentFormat),
      shareVisibility:
        parseOptionalString(record.shareVisibility) ?? 'private',
      contentSyncState:
        parseOptionalString(record.contentSyncState) ?? 'local_only',
      activityId: remapId(parseOptionalNumber(record.activityId), activityMap),
      activityEmoji: parseOptionalString(record.activityEmoji),
      activityLabel: parseOptionalString(record.activityLabel),
    });
  }
}

async function importSettings(rows: unknown[]): Promise<void> {
  const db = await getDatabase();
  for (const row of rows) {
    if (typeof row !== 'object' || row == null) {
      continue;
    }
    const record = row as Record<string, unknown>;
    const key = parseRequiredString(record.key, 'settings.key');
    const value =
      record.value == null ? null : String(record.value);
    await db.insert(settings).values({key, value});
  }
}

export async function importBackupTables(
  tables: BackupBundleTables,
): Promise<void> {
  const activityMap = await importActivities(tables.activities);
  const locationPointMap = await importLocationPoints(tables.location_points);
  const savedPlaceMap = await importSavedPlaces(tables.saved_places);
  const placeLookupMap = await importPlaceLookupCache(tables.place_lookup_cache);
  await importMoments(tables.moments, locationPointMap, activityMap);
  await importSettings(tables.settings);

  void savedPlaceMap;
  void placeLookupMap;
}

export async function applyTripLabelOverrides(
  overrides: TripLabelOverride[],
  maps?: {
    savedPlaceMap: IdMap;
    placeLookupMap: IdMap;
  },
): Promise<number> {
  let applied = 0;
  for (const override of overrides) {
    const trip = await getTripByEventKey(override.eventKey);
    if (!trip) {
      continue;
    }

    const placeId =
      override.placeKind === 'cache' && maps != null
        ? remapId(override.placeId, maps.placeLookupMap)
        : override.placeKind === 'saved' && maps != null
          ? remapId(override.placeId, maps.savedPlaceMap)
          : override.placeId;

    if (
      override.placeLabel != null &&
      override.placeLabel.trim().length > 0
    ) {
      await updateTripCustomLabel(
        trip.id,
        override.placeLabel,
        override.placeKind === 'cache' ? placeId : undefined,
      );
      if (override.placeKind === 'saved' && placeId != null) {
        await updateTripSavedPlaceAssociation(
          trip.id,
          placeId,
          override.placeLabel,
        );
      }
      applied += 1;
      continue;
    }

    if (override.selectedCandidateIndex != null) {
      await updateTripLabelSelection(
        trip.id,
        override.selectedCandidateIndex,
        override.placeKind === 'cache' ? placeId : undefined,
      );
      if (override.placeKind === 'saved' && placeId != null) {
        await updateTripSavedPlaceAssociation(trip.id, placeId);
      }
      applied += 1;
      continue;
    }

    if (override.placeKind === 'saved' && placeId != null) {
      await updateTripSavedPlaceAssociation(trip.id, placeId);
      applied += 1;
    }
  }
  return applied;
}

export async function rebuildTripsAfterRestore(
  onProgress?: (progress: BackupProgress) => void,
): Promise<void> {
  const detectionConfig = getDefaultTripDetectionConfig();
  onProgress?.({
    phase: 'rebuilding_trips',
    message: 'Rebuilding visits and drives…',
    completed: 0,
    total: 0,
  });
  await rebuildAllTrips(detectionConfig, progress => {
    onProgress?.({
      phase: 'rebuilding_trips',
      message:
        progress.phase === 'today'
          ? 'Rebuilding today…'
          : `Rebuilding ${progress.dateKey}…`,
      completed: progress.completed,
      total: progress.total,
    });
  });
}

export async function buildOverrideMaps(
  tables: BackupBundleTables,
): Promise<{savedPlaceMap: IdMap; placeLookupMap: IdMap}> {
  const db = await getDatabase();
  const [savedPlaceRows, placeLookupRows] = await Promise.all([
    db.select().from(savedPlaces).orderBy(savedPlaces.id),
    db.select().from(placeLookupCache).orderBy(placeLookupCache.id),
  ]);

  const savedPlaceMap: IdMap = new Map();
  tables.saved_places.forEach((row, index) => {
    if (typeof row !== 'object' || row == null) {
      return;
    }
    const oldId = Number((row as Record<string, unknown>).id);
    const newRow = savedPlaceRows[index];
    if (Number.isFinite(oldId) && newRow) {
      savedPlaceMap.set(oldId, newRow.id);
    }
  });

  const placeLookupMap: IdMap = new Map();
  tables.place_lookup_cache.forEach((row, index) => {
    if (typeof row !== 'object' || row == null) {
      return;
    }
    const oldId = Number((row as Record<string, unknown>).id);
    const newRow = placeLookupRows[index];
    if (Number.isFinite(oldId) && newRow) {
      placeLookupMap.set(oldId, newRow.id);
    }
  });

  return {savedPlaceMap, placeLookupMap};
}
