import {asc, sql} from 'drizzle-orm';
import ReactNativeBlobUtil from 'react-native-blob-util';

import {getDatabase} from '@/db/client';
import {
  activities,
  locationPoints,
  moments,
  placeLookupCache,
  savedPlaces,
  settings,
  trips,
} from '@/db/schema';
import {getDocumentDirectory} from '@/lib/moments/moment-media-uri';
import {resolveMomentVoiceContentPath} from '@/lib/moments/moment-voice';
import {notePhotoAttachmentPaths} from '@/lib/moments/note-photo-attachments';
import {getAllMoments} from '@/db/repositories/moments';

import {
  BACKUP_FORMAT_VERSION,
  BACKUP_SCHEMA_VERSION,
} from '@/lib/app-constants';
import {
  BACKUP_TABLE_NAMES,
  type BackupManifest,
  type BackupTableName,
  type TripLabelOverride,
  type BackupProgress,
} from './backup-types';
import {ensureDirectory, yieldToUi} from './backup-fs';
import {iso} from './backup-serialize';

export async function estimateLocalBackupBytes(): Promise<number> {
  const mediaFiles = await collectMomentMediaFiles();
  const mediaBytes = mediaFiles.reduce((sum, file) => sum + file.bytes, 0);
  const db = await getDatabase();
  const [
    locationPointRows,
    momentRows,
    tripRows,
    savedPlaceRows,
    activityRows,
  ] = await Promise.all([
    db.select({count: sql<number>`count(*)`}).from(locationPoints),
    db.select({count: sql<number>`count(*)`}).from(moments),
    db.select({count: sql<number>`count(*)`}).from(trips),
    db.select({count: sql<number>`count(*)`}).from(savedPlaces),
    db.select({count: sql<number>`count(*)`}).from(activities),
  ]);
  const locationCount = Number(locationPointRows[0]?.count ?? 0);
  const momentCount = Number(momentRows[0]?.count ?? 0);
  const tripCount = Number(tripRows[0]?.count ?? 0);
  const savedPlaceCount = Number(savedPlaceRows[0]?.count ?? 0);
  const activityCount = Number(activityRows[0]?.count ?? 0);
  const dbEstimate =
    locationCount * 96 +
    momentCount * 280 +
    tripCount * 220 +
    savedPlaceCount * 180 +
    activityCount * 120 +
    48_000;
  return mediaBytes + dbEstimate;
}

export type BackupBundleTables = Record<BackupTableName, unknown[]>;

export type BackupMediaFile = {
  relativePath: string;
  absolutePath: string;
  bytes: number;
};

export type PreparedBackupBundle = {
  manifest: BackupManifest;
  tables: BackupBundleTables;
  mediaFiles: BackupMediaFile[];
  tripOverrides: TripLabelOverride[];
};

function serializeActivities(
  rows: Array<typeof activities.$inferSelect>,
): unknown[] {
  return rows.map(row => ({
    id: row.id,
    emoji: row.emoji,
    label: row.label,
    sortOrder: row.sortOrder,
    createdAt: iso(row.createdAt),
    archivedAt: iso(row.archivedAt),
  }));
}

function serializeLocationPoints(
  rows: Array<typeof locationPoints.$inferSelect>,
): unknown[] {
  return rows.map(row => ({
    id: row.id,
    timestamp: iso(row.timestamp),
    lat: row.lat,
    lng: row.lng,
    accuracy: row.accuracy,
    altitude: row.altitude,
    speed: row.speed,
    source: row.source,
  }));
}

function serializeSavedPlaces(
  rows: Array<typeof savedPlaces.$inferSelect>,
): unknown[] {
  return rows.map(row => ({
    id: row.id,
    kind: row.kind,
    label: row.label,
    lat: row.lat,
    lng: row.lng,
    radiusMeters: row.radiusMeters,
    addressLine: row.addressLine,
    active: row.active,
    createdAt: iso(row.createdAt),
  }));
}

function serializePlaceLookupCache(
  rows: Array<typeof placeLookupCache.$inferSelect>,
): unknown[] {
  return rows.map(row => ({
    id: row.id,
    anchorLat: row.anchorLat,
    anchorLng: row.anchorLng,
    venueRadiusMeters: row.venueRadiusMeters,
    addressLine: row.addressLine,
    candidatesJson: row.candidatesJson,
    selectedCandidateIndex: row.selectedCandidateIndex,
    lookupStatus: row.lookupStatus,
    fetchedAt: iso(row.fetchedAt),
  }));
}

function serializeMoments(rows: Array<typeof moments.$inferSelect>): unknown[] {
  return rows.map(row => ({
    id: row.id,
    type: row.type,
    timestamp: iso(row.timestamp),
    finishedAt: iso(row.finishedAt),
    contentPath: row.contentPath,
    voiceAttachmentPath: row.voiceAttachmentPath,
    voiceAttachmentBytes: row.voiceAttachmentBytes,
    voiceDurationSec: row.voiceDurationSec,
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
  }));
}

function serializeSettings(rows: Array<typeof settings.$inferSelect>): unknown[] {
  return rows.map(row => ({
    id: row.id,
    key: row.key,
    value: row.value,
  }));
}

function serializeTrips(rows: Array<typeof trips.$inferSelect>): unknown[] {
  return rows.map(row => ({
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
    inferred: row.inferred === 1,
    selectedCandidateIndex: row.selectedCandidateIndex,
    detectionVersion: row.detectionVersion,
    closedAt: iso(row.closedAt),
    momentRefs: row.momentRefs,
  }));
}

export function extractTripLabelOverrides(
  tripRows: unknown[],
): TripLabelOverride[] {
  return tripRows
    .map(row => {
      if (typeof row !== 'object' || row == null) {
        return null;
      }
      const record = row as Record<string, unknown>;
      const eventKey =
        typeof record.eventKey === 'string' ? record.eventKey.trim() : '';
      if (!eventKey) {
        return null;
      }
      const placeLabel =
        typeof record.placeLabel === 'string' ? record.placeLabel : null;
      const placeId =
        typeof record.placeId === 'number' ? record.placeId : null;
      const placeKind =
        record.placeKind === 'saved' || record.placeKind === 'cache'
          ? record.placeKind
          : null;
      const selectedCandidateIndex =
        typeof record.selectedCandidateIndex === 'number'
          ? record.selectedCandidateIndex
          : null;
      const hasOverride =
        (placeLabel != null && placeLabel.trim().length > 0) ||
        selectedCandidateIndex != null ||
        placeId != null;
      if (!hasOverride) {
        return null;
      }
      return {
        eventKey,
        placeLabel,
        placeId,
        placeKind,
        selectedCandidateIndex,
      };
    })
    .filter((row): row is TripLabelOverride => row != null);
}

async function collectMomentMediaFiles(): Promise<BackupMediaFile[]> {
  const momentRows = await getAllMoments();
  const docs = getDocumentDirectory();
  const seen = new Set<string>();
  const files: BackupMediaFile[] = [];

  for (const moment of momentRows) {
    const paths = new Set<string>();
    for (const path of notePhotoAttachmentPaths(moment)) {
      paths.add(path);
    }
    const voicePath = resolveMomentVoiceContentPath(moment);
    if (voicePath) {
      paths.add(voicePath);
    }
    if (moment.contentPath && moment.type !== 'note' && moment.type !== 'activity') {
      paths.add(moment.contentPath);
    }

    for (const storedPath of paths) {
      const relativePath = storedPath.startsWith('/')
        ? storedPath.slice(storedPath.indexOf('/moments/') + 1)
        : storedPath;
      if (!relativePath.startsWith('moments/') || seen.has(relativePath)) {
        continue;
      }
      const absolutePath = `${docs}/${relativePath}`;
      if (!(await ReactNativeBlobUtil.fs.exists(absolutePath))) {
        continue;
      }
      seen.add(relativePath);
      const stat = await ReactNativeBlobUtil.fs.stat(absolutePath);
      files.push({
        relativePath,
        absolutePath,
        bytes: Number(stat.size ?? 0),
      });
    }
  }

  return files;
}

export async function prepareBackupBundle(
  appVersion: string,
): Promise<PreparedBackupBundle> {
  const db = await getDatabase();
  const [
    activityRows,
    locationPointRows,
    savedPlaceRows,
    placeLookupRows,
    momentRows,
    settingRows,
    tripRows,
  ] = await Promise.all([
    db.select().from(activities).orderBy(asc(activities.sortOrder), asc(activities.id)),
    db.select().from(locationPoints).orderBy(asc(locationPoints.timestamp)),
    db.select().from(savedPlaces).orderBy(asc(savedPlaces.createdAt)),
    db.select().from(placeLookupCache).orderBy(asc(placeLookupCache.id)),
    db.select().from(moments).orderBy(asc(moments.timestamp)),
    db.select().from(settings).orderBy(asc(settings.key)),
    db.select().from(trips).orderBy(asc(trips.startAt)),
  ]);

  const tables: BackupBundleTables = {
    activities: serializeActivities(activityRows),
    location_points: serializeLocationPoints(locationPointRows),
    saved_places: serializeSavedPlaces(savedPlaceRows),
    place_lookup_cache: serializePlaceLookupCache(placeLookupRows),
    moments: serializeMoments(momentRows),
    settings: serializeSettings(settingRows),
    trips: serializeTrips(tripRows),
  };

  const mediaFiles = await collectMomentMediaFiles();
  const mediaBytes = mediaFiles.reduce((sum, file) => sum + file.bytes, 0);
  const tableCounts = BACKUP_TABLE_NAMES.reduce(
    (counts, tableName) => {
      counts[tableName] = tables[tableName].length;
      return counts;
    },
    {} as Record<BackupTableName, number>,
  );

  const manifest: BackupManifest = {
    format: 'lifemap-backup',
    formatVersion: BACKUP_FORMAT_VERSION,
    schemaVersion: BACKUP_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    appVersion,
    tableCounts,
    mediaFileCount: mediaFiles.length,
    mediaBytes,
    totalBytes: mediaBytes,
  };

  return {
    manifest,
    tables,
    mediaFiles,
    tripOverrides: extractTripLabelOverrides(tables.trips),
  };
}

export async function writeBackupBundleToDirectory(
  bundle: PreparedBackupBundle,
  directoryPath: string,
): Promise<void> {
  const fs = ReactNativeBlobUtil.fs;
  await ensureDirectory(`${directoryPath}/db`);
  await ensureDirectory(`${directoryPath}/media`);

  await fs.writeFile(
    `${directoryPath}/manifest.json`,
    JSON.stringify(bundle.manifest, null, 2),
    'utf8',
  );

  for (const tableName of BACKUP_TABLE_NAMES) {
    await fs.writeFile(
      `${directoryPath}/db/${tableName}.json`,
      JSON.stringify(bundle.tables[tableName], null, 0),
      'utf8',
    );
  }

  await fs.writeFile(
    `${directoryPath}/db/trip_overrides.json`,
    JSON.stringify(bundle.tripOverrides, null, 0),
    'utf8',
  );

  for (const file of bundle.mediaFiles) {
    const destination = `${directoryPath}/media/${file.relativePath.replace(/^moments\//, '')}`;
    const destinationDir = destination.slice(0, destination.lastIndexOf('/'));
    if (destinationDir.length > 0) {
      await ensureDirectory(destinationDir);
    }
    await fs.cp(file.absolutePath, destination);
  }
}

const TABLE_READ_LABELS: Record<BackupTableName, string> = {
  activities: 'activities',
  location_points: 'location history',
  saved_places: 'saved places',
  place_lookup_cache: 'place lookups',
  moments: 'memories',
  settings: 'settings',
  trips: 'visits and drives',
};

export async function readBackupBundleFromDirectory(
  directoryPath: string,
  onProgress?: (progress: BackupProgress) => void,
): Promise<{
  manifest: BackupManifest;
  tables: BackupBundleTables;
  tripOverrides: TripLabelOverride[];
}> {
  const fs = ReactNativeBlobUtil.fs;

  onProgress?.({
    phase: 'downloading',
    message: 'Reading manifest…',
    completed: 0,
    total: 100,
  });
  await yieldToUi();

  const manifestRaw = await fs.readFile(`${directoryPath}/manifest.json`, 'utf8');
  const manifest = JSON.parse(manifestRaw) as BackupManifest;
  if (manifest.format !== 'lifemap-backup') {
    throw new Error('Unsupported backup format.');
  }
  if (manifest.formatVersion > BACKUP_FORMAT_VERSION) {
    throw new Error('This backup requires a newer version of LifeMap.');
  }

  const tableWeights = BACKUP_TABLE_NAMES.map(
    name => Math.max(manifest.tableCounts[name] ?? 0, 1),
  );
  const totalWeight =
    1 + tableWeights.reduce((sum, weight) => sum + weight, 0) + 1;
  let completedWeight = 1;

  const reportReadProgress = (message: string) => {
    onProgress?.({
      phase: 'downloading',
      message,
      completed: completedWeight,
      total: totalWeight,
    });
  };

  reportReadProgress('Reading manifest…');

  const tables = {} as BackupBundleTables;
  for (let index = 0; index < BACKUP_TABLE_NAMES.length; index += 1) {
    const tableName = BACKUP_TABLE_NAMES[index]!;
    reportReadProgress(`Reading ${TABLE_READ_LABELS[tableName]}…`);
    await yieldToUi();
    const raw = await fs.readFile(`${directoryPath}/db/${tableName}.json`, 'utf8');
    tables[tableName] = JSON.parse(raw) as unknown[];
    completedWeight += tableWeights[index]!;
    reportReadProgress(`Reading ${TABLE_READ_LABELS[tableName]}…`);
    await yieldToUi();
  }

  let tripOverrides: TripLabelOverride[] = [];
  const overridesPath = `${directoryPath}/db/trip_overrides.json`;
  reportReadProgress('Reading trip labels…');
  await yieldToUi();
  if (await fs.exists(overridesPath)) {
    tripOverrides = JSON.parse(
      await fs.readFile(overridesPath, 'utf8'),
    ) as TripLabelOverride[];
  } else {
    tripOverrides = extractTripLabelOverrides(tables.trips);
  }
  completedWeight += 1;
  reportReadProgress('Backup read complete');

  return {manifest, tables, tripOverrides};
}
