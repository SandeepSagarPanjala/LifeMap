import {eq} from 'drizzle-orm';

import {getDatabase} from '@/db/client';
import {
  activities,
  locationPoints,
  moments,
  placeLookupCache,
  savedPlaces,
  settings,
} from '@/db/schema';
import {getAllMoments, deleteMoment} from '@/db/repositories/moments';
import {getSetting, setSetting} from '@/db/repositories/settings';

import type {BackupBundleTables} from './backup-export';
import {readBackupBundleFromDirectory} from './backup-export';
import {
  buildConflictResolutionMap,
  detectRestoreConflicts,
  locationPointKey,
  momentKey,
  settingKey,
  type RestoreConflict,
  type RestoreConflictChoice,
} from './backup-conflicts';
import {
  applyTripLabelOverrides,
  rebuildTripsAfterRestore,
} from './backup-import';
import {
  parseIsoDate,
  parseOptionalNumber,
  parseOptionalString,
  parseRequiredIsoDate,
  parseRequiredNumber,
  parseRequiredString,
} from './backup-serialize';
import type {BackupProgress, TripLabelOverride} from './backup-types';
import {copyBackupMediaToSandbox} from './backup-clear';
import {
  downloadBackupDirectory,
  getBackupStagingDirectory,
  getCloudProviderLabel,
} from './native-backup-cloud';
import {prepareEmptyDirectory, removeDirectoryRecursive} from './backup-fs';

type IdMap = Map<number, number>;

export type MergeRestorePlan = {
  tables: BackupBundleTables;
  tripOverrides: TripLabelOverride[];
  conflicts: RestoreConflict[];
  stagingPath: string;
  manifestExportedAt: string;
};

async function loadLocalRowsForConflictDetection() {
  const db = await getDatabase();
  const [locationRows, momentRows, settingRows] = await Promise.all([
    db.select().from(locationPoints),
    getAllMoments(),
    db.select().from(settings),
  ]);

  return {
    localLocationPoints: locationRows.map(row => ({
      timestamp: row.timestamp,
      lat: row.lat,
      lng: row.lng,
      source: row.source,
      accuracy: row.accuracy,
    })),
    localMoments: momentRows.map(row => ({
      timestamp: row.timestamp,
      type: row.type,
      contentPath: row.contentPath,
      textBody: row.textBody,
      caption: row.caption,
    })),
    localSettings: settingRows.map(row => ({
      key: row.key,
      value: row.value,
    })),
  };
}

export async function prepareMergeRestore(
  onProgress?: (progress: BackupProgress) => void,
): Promise<MergeRestorePlan> {
  const stagingPath = getBackupStagingDirectory();
  await prepareEmptyDirectory(stagingPath);

  onProgress?.({
    phase: 'downloading',
    message: `Downloading from ${getCloudProviderLabel()}…`,
  });
  await downloadBackupDirectory(stagingPath);

  const {manifest, tables, tripOverrides} =
    await readBackupBundleFromDirectory(stagingPath);

  const local = await loadLocalRowsForConflictDetection();
  const conflicts = detectRestoreConflicts({
    backupTables: tables,
    ...local,
  });

  return {
    tables,
    tripOverrides,
    conflicts,
    stagingPath,
    manifestExportedAt: manifest.exportedAt,
  };
}

function activityNaturalKey(emoji: string, label: string): string {
  return `${emoji.trim()}|${label.trim()}`;
}

function savedPlaceNaturalKey(
  kind: string,
  label: string,
  lat: number,
  lng: number,
): string {
  return `${kind}|${label.trim()}|${lat.toFixed(5)}|${lng.toFixed(5)}`;
}

function placeLookupNaturalKey(lat: number, lng: number): string {
  return `${lat.toFixed(5)}|${lng.toFixed(5)}`;
}

async function mergeActivities(
  rows: unknown[],
): Promise<IdMap> {
  const db = await getDatabase();
  const existing = await db.select().from(activities);
  const byKey = new Map(
    existing.map(row => [
      activityNaturalKey(row.emoji, row.label),
      row.id,
    ]),
  );
  const map: IdMap = new Map();

  for (const row of rows) {
    if (typeof row !== 'object' || row == null) {
      continue;
    }
    const record = row as Record<string, unknown>;
    const oldId = parseRequiredNumber(record.id, 'activities.id');
    const emoji = parseRequiredString(record.emoji, 'activities.emoji');
    const label = parseRequiredString(record.label, 'activities.label');
    const key = activityNaturalKey(emoji, label);
    const existingId = byKey.get(key);
    if (existingId != null) {
      map.set(oldId, existingId);
      continue;
    }
    const inserted = await db
      .insert(activities)
      .values({
        emoji,
        label,
        sortOrder: parseRequiredNumber(record.sortOrder, 'activities.sortOrder'),
        createdAt: parseRequiredIsoDate(record.createdAt, 'activities.createdAt'),
        archivedAt: parseIsoDate(record.archivedAt),
      })
      .returning({id: activities.id});
    const newId = inserted[0]!.id;
    map.set(oldId, newId);
    byKey.set(key, newId);
  }

  return map;
}

async function mergeLocationPoints(
  rows: unknown[],
  resolutions: Map<string, RestoreConflictChoice>,
): Promise<IdMap> {
  const db = await getDatabase();
  const existingRows = await db.select().from(locationPoints);
  const localByKey = new Map(
    existingRows.map(row => [
      locationPointKey(row.timestamp.getTime(), row.lat, row.lng),
      row,
    ]),
  );
  const map: IdMap = new Map();

  for (const row of rows) {
    if (typeof row !== 'object' || row == null) {
      continue;
    }
    const record = row as Record<string, unknown>;
    const oldId = parseRequiredNumber(record.id, 'location_points.id');
    const timestamp = parseRequiredIsoDate(record.timestamp, 'location_points.timestamp');
    const lat = parseRequiredNumber(record.lat, 'location_points.lat');
    const lng = parseRequiredNumber(record.lng, 'location_points.lng');
    const key = locationPointKey(timestamp.getTime(), lat, lng);
    const conflictId = `location_point:${key}`;
    const local = localByKey.get(key);

    if (local) {
      const choice = resolutions.get(conflictId) ?? 'local';
      if (choice === 'local') {
        map.set(oldId, local.id);
        continue;
      }
      await db.delete(locationPoints).where(eq(locationPoints.id, local.id));
      localByKey.delete(key);
    }

    const inserted = await db
      .insert(locationPoints)
      .values({
        timestamp,
        lat,
        lng,
        accuracy: parseOptionalNumber(record.accuracy),
        altitude: parseOptionalNumber(record.altitude),
        speed: parseOptionalNumber(record.speed),
        source: parseRequiredString(record.source, 'location_points.source'),
      })
      .returning({id: locationPoints.id});
    const newId = inserted[0]!.id;
    map.set(oldId, newId);
    localByKey.set(key, {
      id: newId,
      timestamp,
      lat,
      lng,
      accuracy: parseOptionalNumber(record.accuracy),
      altitude: parseOptionalNumber(record.altitude),
      speed: parseOptionalNumber(record.speed),
      source: parseRequiredString(record.source, 'location_points.source'),
    });
  }

  return map;
}

async function mergeSavedPlaces(rows: unknown[]): Promise<IdMap> {
  const db = await getDatabase();
  const existing = await db.select().from(savedPlaces);
  const byKey = new Map(
    existing.map(row => [
      savedPlaceNaturalKey(row.kind, row.label, row.lat, row.lng),
      row.id,
    ]),
  );
  const map: IdMap = new Map();

  for (const row of rows) {
    if (typeof row !== 'object' || row == null) {
      continue;
    }
    const record = row as Record<string, unknown>;
    const oldId = parseRequiredNumber(record.id, 'saved_places.id');
    const kind = parseRequiredString(record.kind, 'saved_places.kind');
    if (kind !== 'home' && kind !== 'work' && kind !== 'favorite') {
      continue;
    }
    const label = parseRequiredString(record.label, 'saved_places.label');
    const lat = parseRequiredNumber(record.lat, 'saved_places.lat');
    const lng = parseRequiredNumber(record.lng, 'saved_places.lng');
    const key = savedPlaceNaturalKey(kind, label, lat, lng);
    const existingId = byKey.get(key);
    if (existingId != null) {
      map.set(oldId, existingId);
      continue;
    }
    const inserted = await db
      .insert(savedPlaces)
      .values({
        kind,
        label,
        lat,
        lng,
        radiusMeters: parseRequiredNumber(
          record.radiusMeters,
          'saved_places.radiusMeters',
        ),
        addressLine: parseOptionalString(record.addressLine),
        createdAt: parseRequiredIsoDate(record.createdAt, 'saved_places.createdAt'),
      })
      .returning({id: savedPlaces.id});
    const newId = inserted[0]!.id;
    map.set(oldId, newId);
    byKey.set(key, newId);
  }

  return map;
}

async function mergePlaceLookupCache(rows: unknown[]): Promise<IdMap> {
  const db = await getDatabase();
  const existing = await db.select().from(placeLookupCache);
  const byKey = new Map(
    existing.map(row => [
      placeLookupNaturalKey(row.anchorLat, row.anchorLng),
      row.id,
    ]),
  );
  const map: IdMap = new Map();

  for (const row of rows) {
    if (typeof row !== 'object' || row == null) {
      continue;
    }
    const record = row as Record<string, unknown>;
    const oldId = parseRequiredNumber(record.id, 'place_lookup_cache.id');
    const anchorLat = parseRequiredNumber(record.anchorLat, 'place_lookup_cache.anchorLat');
    const anchorLng = parseRequiredNumber(record.anchorLng, 'place_lookup_cache.anchorLng');
    const key = placeLookupNaturalKey(anchorLat, anchorLng);
    const existingId = byKey.get(key);
    if (existingId != null) {
      map.set(oldId, existingId);
      continue;
    }
    const inserted = await db
      .insert(placeLookupCache)
      .values({
        anchorLat,
        anchorLng,
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
    const newId = inserted[0]!.id;
    map.set(oldId, newId);
    byKey.set(key, newId);
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

function remapId(value: number | null | undefined, map: IdMap): number | null {
  if (value == null) {
    return null;
  }
  return map.get(value) ?? null;
}

async function mergeMoments(
  rows: unknown[],
  locationPointMap: IdMap,
  activityMap: IdMap,
  resolutions: Map<string, RestoreConflictChoice>,
): Promise<void> {
  const db = await getDatabase();
  const existingMoments = await getAllMoments();
  const localByKey = new Map(
    existingMoments.map(row => [
      momentKey(
        row.timestamp.getTime(),
        row.type,
        row.contentPath,
        row.textBody,
      ),
      row,
    ]),
  );

  for (const row of rows) {
    if (typeof row !== 'object' || row == null) {
      continue;
    }
    const record = row as Record<string, unknown>;
    const type = parseRequiredString(record.type, 'moments.type');
    if (!MOMENT_TYPES.has(type)) {
      throw new Error(`Unsupported moment type: ${type}`);
    }
    const timestamp = parseRequiredIsoDate(record.timestamp, 'moments.timestamp');
    const contentPath = parseOptionalString(record.contentPath);
    const textBody = parseOptionalString(record.textBody);
    const key = momentKey(timestamp.getTime(), type, contentPath, textBody);
    const conflictId = `moment:${key}`;
    const local = localByKey.get(key);

    if (local) {
      const choice = resolutions.get(conflictId) ?? 'local';
      if (choice === 'local') {
        continue;
      }
      await deleteMoment(local.id);
      localByKey.delete(key);
    }

    await db.insert(moments).values({
      type: type as 'photo' | 'note' | 'video' | 'voice' | 'activity',
      timestamp,
      finishedAt: parseIsoDate(record.finishedAt),
      lat: parseOptionalNumber(record.lat),
      lng: parseOptionalNumber(record.lng),
      contentPath,
      voiceAttachmentPath: parseOptionalString(record.voiceAttachmentPath),
      voiceAttachmentBytes: parseOptionalNumber(record.voiceAttachmentBytes),
      voiceDurationSec: parseOptionalNumber(record.voiceDurationSec),
      photoAttachmentsJson:
        typeof record.photoAttachmentsJson === 'string'
          ? record.photoAttachmentsJson
          : null,
      textBody,
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

async function mergeSettings(
  rows: unknown[],
  resolutions: Map<string, RestoreConflictChoice>,
): Promise<void> {
  for (const row of rows) {
    if (typeof row !== 'object' || row == null) {
      continue;
    }
    const record = row as Record<string, unknown>;
    const key = parseRequiredString(record.key, 'settings.key');
    const backupValue = record.value == null ? null : String(record.value);
    const conflictId = `setting:${settingKey(key)}`;
    const localValue = await getSetting(key);

    if (localValue != null) {
      if (localValue === backupValue) {
        continue;
      }
      const choice = resolutions.get(conflictId) ?? 'local';
      if (choice === 'local') {
        continue;
      }
    } else if (localValue == null && backupValue == null) {
      continue;
    }

    if (localValue == null) {
      await setSetting(key, backupValue ?? '');
      continue;
    }

    await setSetting(key, backupValue ?? '');
  }
}

export async function executeMergeRestore(input: {
  plan: MergeRestorePlan;
  conflictChoices?: Record<string, RestoreConflictChoice | undefined>;
  onProgress?: (progress: BackupProgress) => void;
}): Promise<void> {
  const resolutions = buildConflictResolutionMap(
    input.plan.conflicts,
    input.conflictChoices ?? {},
  );

  input.onProgress?.({phase: 'importing', message: 'Merging your data…'});

  const activityMap = await mergeActivities(input.plan.tables.activities);
  const locationPointMap = await mergeLocationPoints(
    input.plan.tables.location_points,
    resolutions,
  );
  const savedPlaceMap = await mergeSavedPlaces(input.plan.tables.saved_places);
  const placeLookupMap = await mergePlaceLookupCache(
    input.plan.tables.place_lookup_cache,
  );
  await mergeMoments(
    input.plan.tables.moments,
    locationPointMap,
    activityMap,
    resolutions,
  );
  await mergeSettings(input.plan.tables.settings, resolutions);

  onProgress?.({phase: 'copying_media', message: 'Copying memories…'});
  await copyBackupMediaToSandbox(input.plan.stagingPath);

  const overrideMaps = {
    savedPlaceMap,
    placeLookupMap,
  };
  await rebuildTripsAfterRestore(input.onProgress);
  await applyTripLabelOverrides(input.plan.tripOverrides, overrideMaps);

  await removeDirectoryRecursive(input.plan.stagingPath);
}

export async function runMergeRestoreFromCloud(input: {
  conflictChoices?: Record<string, RestoreConflictChoice | undefined>;
  onProgress?: (progress: BackupProgress) => void;
}): Promise<{conflicts: RestoreConflict[]}> {
  const plan = await prepareMergeRestore(input.onProgress);
  await executeMergeRestore({
    plan,
    conflictChoices: input.conflictChoices,
    onProgress: input.onProgress,
  });
  return {conflicts: plan.conflicts};
}
