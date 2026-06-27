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
  resolveRestoreConflictChoice,
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
import {copyBackupMediaToSandbox, hasLocalUserData} from './backup-clear';
import {
  downloadBackupDirectory,
  getBackupStagingDirectory,
  getCloudProviderLabel,
} from './native-backup-cloud';
import {prepareEmptyDirectory, removeDirectoryRecursive, yieldToUi} from './backup-fs';

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

export async function prepareMergeRestoreFromDirectory(
  stagingPath: string,
  onProgress?: (progress: BackupProgress) => void,
): Promise<MergeRestorePlan> {
  const {manifest, tables, tripOverrides} = await readBackupBundleFromDirectory(
    stagingPath,
    onProgress,
  );

  onProgress?.({
    phase: 'downloading',
    message: 'Checking for overlaps…',
    completed: 99,
    total: 100,
  });
  await yieldToUi();

  let conflicts: RestoreConflict[] = [];
  if (await hasLocalUserData()) {
    const local = await loadLocalRowsForConflictDetection();
    conflicts = detectRestoreConflicts({
      backupTables: tables,
      ...local,
    });
  }

  onProgress?.({
    phase: 'downloading',
    message: 'Backup ready',
    completed: 100,
    total: 100,
  });

  return {
    tables,
    tripOverrides,
    conflicts,
    stagingPath,
    manifestExportedAt: manifest.exportedAt,
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

  return prepareMergeRestoreFromDirectory(stagingPath, onProgress);
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
  onRowProgress?: (completed: number, total: number) => void,
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
  const total = rows.length;

  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    if (index % 1000 === 0) {
      onRowProgress?.(index, total);
      await yieldToUi();
    }
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
      const choice = resolveRestoreConflictChoice(
        resolutions,
        conflictId,
        'location_point:bulk',
      );
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

  onRowProgress?.(total, total);
  return map;
}

async function mergeSavedPlaces(
  rows: unknown[],
): Promise<IdMap> {
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
        active:
          typeof record.active === 'number'
            ? record.active
            : record.active === false
              ? 0
              : 1,
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
      const choice = resolveRestoreConflictChoice(
        resolutions,
        conflictId,
        'moment:bulk',
      );
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

  const tables = input.plan.tables;
  const mergeSteps = [
    {label: 'activities', weight: Math.max(tables.activities.length, 1)},
    {label: 'location history', weight: Math.max(tables.location_points.length, 1)},
    {label: 'saved places', weight: Math.max(tables.saved_places.length, 1)},
    {label: 'place lookups', weight: Math.max(tables.place_lookup_cache.length, 1)},
    {label: 'memories', weight: Math.max(tables.moments.length, 1)},
    {label: 'settings', weight: Math.max(tables.settings.length, 1)},
  ];
  const mergeTotal = mergeSteps.reduce((sum, step) => sum + step.weight, 0);
  let mergeBase = 0;

  const reportMerge = (
    label: string,
    stepCompleted?: number,
    stepTotal?: number,
  ) => {
    const completed =
      stepCompleted != null && stepTotal != null && stepTotal > 0
        ? mergeBase + stepCompleted
        : mergeBase;
    input.onProgress?.({
      phase: 'importing',
      message: `Merging ${label}…`,
      completed,
      total: mergeTotal,
    });
  };

  reportMerge('activities');
  await yieldToUi();
  const activityMap = await mergeActivities(tables.activities);
  mergeBase += mergeSteps[0]!.weight;

  reportMerge('location history', 0, tables.location_points.length);
  await yieldToUi();
  const locationPointMap = await mergeLocationPoints(
    tables.location_points,
    resolutions,
    (completed, total) => reportMerge('location history', completed, total),
  );
  mergeBase += mergeSteps[1]!.weight;

  reportMerge('saved places');
  await yieldToUi();
  const savedPlaceMap = await mergeSavedPlaces(tables.saved_places);
  mergeBase += mergeSteps[2]!.weight;

  reportMerge('place lookups');
  await yieldToUi();
  const placeLookupMap = await mergePlaceLookupCache(tables.place_lookup_cache);
  mergeBase += mergeSteps[3]!.weight;

  reportMerge('memories');
  await yieldToUi();
  await mergeMoments(
    tables.moments,
    locationPointMap,
    activityMap,
    resolutions,
  );
  mergeBase += mergeSteps[4]!.weight;

  reportMerge('settings');
  await yieldToUi();
  await mergeSettings(tables.settings, resolutions);
  mergeBase += mergeSteps[5]!.weight;

  input.onProgress?.({
    phase: 'copying_media',
    message: 'Copying memories…',
    completed: 0,
    total: 100,
  });
  await copyBackupMediaToSandbox(input.plan.stagingPath, input.onProgress);

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
