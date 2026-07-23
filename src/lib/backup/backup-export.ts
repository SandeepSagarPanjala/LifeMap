import { asc, gt, sql } from 'drizzle-orm';
import ReactNativeBlobUtil from 'react-native-blob-util';

import { getDatabase } from '@/db/client';
import {
  activities,
  locationPoints,
  moments,
  placeLookupCache,
  savedPlaces,
  settings,
  trips,
} from '@/db/schema';
import { getDocumentDirectory } from '@/lib/moments/moment-media-uri';
import { resolveMomentVoiceContentPath } from '@/lib/moments/moment-voice';
import { notePhotoAttachmentPaths } from '@/lib/moments/note-photo-attachments';
import { getAllMoments } from '@/db/repositories/moments';

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
import { ensureDirectory, yieldToUi } from './backup-fs';
import { iso } from './backup-serialize';

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
    db.select({ count: sql<number>`count(*)` }).from(locationPoints),
    db.select({ count: sql<number>`count(*)` }).from(moments),
    db.select({ count: sql<number>`count(*)` }).from(trips),
    db.select({ count: sql<number>`count(*)` }).from(savedPlaces),
    db.select({ count: sql<number>`count(*)` }).from(activities),
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

function serializeLocationPoint(
  row: typeof locationPoints.$inferSelect,
): unknown {
  return {
    id: row.id,
    timestamp: iso(row.timestamp),
    lat: row.lat,
    lng: row.lng,
    accuracy: row.accuracy,
    altitude: row.altitude,
    speed: row.speed,
    source: row.source,
    heading: row.heading,
    headingAccuracy: row.headingAccuracy,
    speedAccuracy: row.speedAccuracy,
    altitudeAccuracy: row.altitudeAccuracy,
    activityType: row.activityType,
    activityConfidence: row.activityConfidence,
    isMoving: row.isMoving,
    isMock: row.isMock,
    uuid: row.uuid,
    batteryLevel: row.batteryLevel,
    batteryIsCharging: row.batteryIsCharging,
  };
}

/** UTF-8 byte length without requiring TextEncoder (not always present on RN). */
function utf8ByteLength(value: string): number {
  if (typeof TextEncoder !== 'undefined') {
    return new TextEncoder().encode(value).length;
  }
  // Fallback: count UTF-8 bytes manually.
  let bytes = 0;
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code <= 0x7f) {
      bytes += 1;
    } else if (code <= 0x7ff) {
      bytes += 2;
    } else if (code >= 0xd800 && code <= 0xdbff) {
      // Surrogate pair
      bytes += 4;
      index += 1;
    } else {
      bytes += 3;
    }
  }
  return bytes;
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

function serializeSettings(
  rows: Array<typeof settings.$inferSelect>,
): unknown[] {
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
  const overrides: TripLabelOverride[] = [];
  for (const row of tripRows) {
    if (typeof row !== 'object' || row == null) {
      continue;
    }
    const record = row as Record<string, unknown>;
    const eventKey =
      typeof record.eventKey === 'string' ? record.eventKey.trim() : '';
    if (!eventKey) {
      continue;
    }
    const placeLabel =
      typeof record.placeLabel === 'string' ? record.placeLabel : null;
    const placeId = typeof record.placeId === 'number' ? record.placeId : null;
    const placeKind =
      record.placeKind === 'saved' || record.placeKind === 'cache'
        ? record.placeKind
        : null;
    const selectedCandidateIndex =
      typeof record.selectedCandidateIndex === 'number'
        ? record.selectedCandidateIndex
        : null;
    const poiId = typeof record.poiId === 'number' ? record.poiId : null;
    const poiLabel =
      typeof record.poiLabel === 'string' ? record.poiLabel : null;
    const dateKey =
      typeof record.dateKey === 'string' ? record.dateKey.trim() : null;
    const startAtMs = parseStartAtMs(record);
    // Only user choices — not reverse-geocode addresses (those wipe poi on apply).
    const hasOverride =
      poiId != null ||
      placeKind === 'saved' ||
      selectedCandidateIndex != null;
    if (!hasOverride) {
      continue;
    }
    overrides.push({
      eventKey,
      dateKey,
      startAtMs,
      placeLabel,
      placeId,
      placeKind,
      selectedCandidateIndex,
      poiId,
      poiLabel,
    });
  }
  return overrides;
}

function parseStartAtMs(record: Record<string, unknown>): number | null {
  const startAt = record.startAt;
  if (startAt instanceof Date && !Number.isNaN(startAt.getTime())) {
    return startAt.getTime();
  }
  if (typeof startAt === 'number' && Number.isFinite(startAt)) {
    return startAt;
  }
  if (typeof startAt === 'string' && startAt.trim().length > 0) {
    const parsed = Date.parse(startAt);
    return Number.isNaN(parsed) ? null : parsed;
  }
  if (typeof record.startAtMs === 'number' && Number.isFinite(record.startAtMs)) {
    return record.startAtMs;
  }
  return null;
}

async function collectMomentMediaFiles(
  onProgress?: (message: string) => void,
): Promise<BackupMediaFile[]> {
  const momentRows = await getAllMoments();
  const docs = getDocumentDirectory();
  const seen = new Set<string>();
  const files: BackupMediaFile[] = [];

  for (let index = 0; index < momentRows.length; index += 1) {
    const moment = momentRows[index]!;
    const paths = new Set<string>();
    for (const path of notePhotoAttachmentPaths(moment)) {
      paths.add(path);
    }
    const voicePath = resolveMomentVoiceContentPath(moment);
    if (voicePath) {
      paths.add(voicePath);
    }
    if (
      moment.contentPath &&
      moment.type !== 'note' &&
      moment.type !== 'activity'
    ) {
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

    if (index > 0 && index % 25 === 0) {
      onProgress?.(
        `Gathering photos and voice notes (${index}/${momentRows.length})`,
      );
      await yieldToUi();
    }
  }

  return files;
}

const TABLE_EXPORT_LABELS: Record<BackupTableName, string> = {
  activities: 'Preparing activities',
  location_points: 'Preparing location history',
  saved_places: 'Preparing saved places',
  place_lookup_cache: 'Preparing place lookups',
  moments: 'Preparing memories',
  settings: 'Preparing settings',
  trips: 'Preparing visits and drives',
};

const TABLE_SAVE_LABELS: Record<BackupTableName, string> = {
  activities: 'Saving activities',
  location_points: 'Saving location history',
  saved_places: 'Saving saved places',
  place_lookup_cache: 'Saving place lookups',
  moments: 'Saving memories',
  settings: 'Saving settings',
  trips: 'Saving visits and drives',
};

const LOCATION_POINT_PAGE_SIZE = 25_000;
const JSON_ARRAY_WRITE_CHUNK = 1_000;

export type BackupByteProgressRange = {
  baseCompletedBytes: number;
  phaseSpanBytes: number;
  totalBytes: number;
};

function bytesForPhaseFraction(
  range: BackupByteProgressRange | undefined,
  fraction: number,
): { completedBytes?: number; totalBytes?: number } {
  if (range == null) {
    return {};
  }
  const clamped = Math.min(1, Math.max(0, fraction));
  return {
    completedBytes:
      range.baseCompletedBytes + Math.round(range.phaseSpanBytes * clamped),
    totalBytes: range.totalBytes,
  };
}

async function countLocationPoints(): Promise<number> {
  const db = await getDatabase();
  const rows = await db
    .select({ count: sql<number>`count(*)` })
    .from(locationPoints);
  return Number(rows[0]?.count ?? 0);
}

/** Write a JSON array without one giant stringify that freezes the JS thread. */
async function writeJsonArrayFile(
  path: string,
  items: unknown[],
  onChunk?: (done: number, total: number) => void,
): Promise<number> {
  const fs = ReactNativeBlobUtil.fs;
  if (items.length <= JSON_ARRAY_WRITE_CHUNK) {
    const contents = JSON.stringify(items);
    await fs.writeFile(path, contents, 'utf8');
    return utf8ByteLength(contents);
  }

  const stream = await fs.writeStream(path, 'utf8', false);
  let bytes = 1;
  try {
    await stream.write('[');
    for (let index = 0; index < items.length; index += JSON_ARRAY_WRITE_CHUNK) {
      const slice = items.slice(index, index + JSON_ARRAY_WRITE_CHUNK);
      const body = slice.map(item => JSON.stringify(item)).join(',');
      const piece = (index === 0 ? '' : ',') + body;
      await stream.write(piece);
      bytes += utf8ByteLength(piece);
      onChunk?.(Math.min(index + slice.length, items.length), items.length);
      await yieldToUi();
    }
    await stream.write(']');
  } finally {
    await stream.close().catch(() => undefined);
  }
  return bytes + 1;
}

/**
 * Stream location history from SQLite → JSON in pages so backup does not load
 * the entire table into memory or block the UI for minutes.
 */
async function streamLocationPointsToJsonFile(
  path: string,
  onChunk?: (done: number, total: number) => void,
): Promise<{ bytes: number; count: number }> {
  const db = await getDatabase();
  const total = await countLocationPoints();
  const stream = await ReactNativeBlobUtil.fs.writeStream(path, 'utf8', false);

  let bytes = 1;
  let written = 0;
  let lastId = 0;
  let first = true;

  try {
    await stream.write('[');

    while (true) {
      const rows = await db
        .select()
        .from(locationPoints)
        .where(gt(locationPoints.id, lastId))
        .orderBy(asc(locationPoints.id))
        .limit(LOCATION_POINT_PAGE_SIZE);

      if (rows.length === 0) {
        break;
      }

      const parts: string[] = [];
      for (const row of rows) {
        parts.push(JSON.stringify(serializeLocationPoint(row)));
        lastId = row.id;
      }
      const piece = (first ? '' : ',') + parts.join(',');
      first = false;
      await stream.write(piece);
      bytes += utf8ByteLength(piece);
      written += rows.length;
      onChunk?.(written, Math.max(total, written));
      await yieldToUi();
    }

    await stream.write(']');
  } finally {
    await stream.close().catch(() => undefined);
  }
  return { bytes: bytes + 1, count: written };
}

export async function prepareBackupBundle(
  appVersion: string,
  onProgress?: (progress: BackupProgress) => void,
  progressRange?: BackupByteProgressRange,
): Promise<PreparedBackupBundle> {
  const db = await getDatabase();
  const report = (message: string, fraction: number) => {
    onProgress?.({
      phase: 'exporting',
      message,
      ...bytesForPhaseFraction(progressRange, fraction),
    });
  };

  report('Preparing your map data', 0);
  await yieldToUi();

  report(TABLE_EXPORT_LABELS.activities, 0.05);
  await yieldToUi();
  const activityRows = await db
    .select()
    .from(activities)
    .orderBy(asc(activities.sortOrder), asc(activities.id));

  // Count only — full location history is streamed to disk during write.
  report(TABLE_EXPORT_LABELS.location_points, 0.1);
  await yieldToUi();
  const locationPointCount = await countLocationPoints();
  report(
    `Preparing location history (${locationPointCount.toLocaleString()} points)`,
    0.2,
  );
  await yieldToUi();

  report(TABLE_EXPORT_LABELS.saved_places, 0.25);
  await yieldToUi();
  const savedPlaceRows = await db
    .select()
    .from(savedPlaces)
    .orderBy(asc(savedPlaces.createdAt));

  report(TABLE_EXPORT_LABELS.place_lookup_cache, 0.35);
  await yieldToUi();
  const placeLookupRows = await db
    .select()
    .from(placeLookupCache)
    .orderBy(asc(placeLookupCache.id));

  report(TABLE_EXPORT_LABELS.moments, 0.45);
  await yieldToUi();
  const momentRows = await db
    .select()
    .from(moments)
    .orderBy(asc(moments.timestamp));

  report(TABLE_EXPORT_LABELS.settings, 0.55);
  await yieldToUi();
  const settingRows = await db
    .select()
    .from(settings)
    .orderBy(asc(settings.key));

  report(TABLE_EXPORT_LABELS.trips, 0.6);
  await yieldToUi();
  const tripRows = await db.select().from(trips).orderBy(asc(trips.startAt));

  report('Packaging your map data', 0.7);
  await yieldToUi();
  const tables: BackupBundleTables = {
    activities: serializeActivities(activityRows),
    // Streamed during write — keeping millions of rows here freezes the app.
    location_points: [],
    saved_places: serializeSavedPlaces(savedPlaceRows),
    place_lookup_cache: [],
    moments: [],
    settings: serializeSettings(settingRows),
    trips: [],
  };

  // Serialize larger tables in slices so React can keep painting progress.
  const serializeChunked = async <T,>(
    rows: T[],
    serialize: (rows: T[]) => unknown[],
    message: string,
    startFraction: number,
    endFraction: number,
  ): Promise<unknown[]> => {
    const chunkSize = 400;
    const out: unknown[] = [];
    for (let index = 0; index < rows.length; index += chunkSize) {
      const slice = rows.slice(index, index + chunkSize);
      out.push(...serialize(slice));
      const fraction =
        startFraction +
        ((endFraction - startFraction) * Math.min(index + chunkSize, rows.length)) /
          Math.max(rows.length, 1);
      report(
        `${message} (${Math.min(index + chunkSize, rows.length).toLocaleString()}/${rows.length.toLocaleString()})`,
        fraction,
      );
      await yieldToUi();
    }
    return out;
  };

  tables.place_lookup_cache = await serializeChunked(
    placeLookupRows,
    serializePlaceLookupCache,
    'Preparing place lookups',
    0.7,
    0.78,
  );
  tables.moments = await serializeChunked(
    momentRows,
    serializeMoments,
    'Preparing memories',
    0.78,
    0.86,
  );
  tables.trips = await serializeChunked(
    tripRows,
    serializeTrips,
    'Preparing visits and drives',
    0.86,
    0.9,
  );

  report('Gathering photos and voice notes', 0.91);
  await yieldToUi();
  const mediaFiles = await collectMomentMediaFiles(message => {
    report(message, 0.93);
  });
  report('Gathering photos and voice notes', 0.95);
  await yieldToUi();

  const mediaBytes = mediaFiles.reduce((sum, file) => sum + file.bytes, 0);
  const tableCounts = BACKUP_TABLE_NAMES.reduce((counts, tableName) => {
    counts[tableName] =
      tableName === 'location_points'
        ? locationPointCount
        : tables[tableName].length;
    return counts;
  }, {} as Record<BackupTableName, number>);

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

  report('Preparing your map data', 1);
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
  onProgress?: (progress: BackupProgress) => void,
  progressRange?: BackupByteProgressRange,
): Promise<number> {
  const fs = ReactNativeBlobUtil.fs;
  await ensureDirectory(`${directoryPath}/db`);
  await ensureDirectory(`${directoryPath}/media`);

  const locationPointCount = bundle.manifest.tableCounts.location_points ?? 0;
  const estimatedDbBytes =
    locationPointCount * 96 +
    Object.entries(bundle.manifest.tableCounts).reduce((sum, [name, count]) => {
      if (name === 'location_points') {
        return sum;
      }
      return sum + Math.max(count, 0) * 180;
    }, 0) +
    64_000;
  const estimatedWriteTotal = Math.max(
    bundle.mediaFiles.reduce((sum, file) => sum + file.bytes, 0) +
      estimatedDbBytes,
    1,
  );

  let writtenBytes = 0;

  const report = (
    message: string,
    phase: BackupProgress['phase'],
    fractionOverride?: number,
  ) => {
    const fraction =
      fractionOverride ??
      Math.min(0.99, writtenBytes / Math.max(estimatedWriteTotal, 1));
    onProgress?.({
      phase,
      message,
      ...bytesForPhaseFraction(progressRange, fraction),
    });
  };

  const writeText = async (path: string, contents: string, message: string) => {
    await fs.writeFile(path, contents, 'utf8');
    writtenBytes += utf8ByteLength(contents);
    report(message, 'exporting');
    await yieldToUi();
  };

  await writeText(
    `${directoryPath}/manifest.json`,
    JSON.stringify(bundle.manifest, null, 2),
    'Saving backup summary',
  );

  for (const tableName of BACKUP_TABLE_NAMES) {
    const filePath = `${directoryPath}/db/${tableName}.json`;
    if (tableName === 'location_points') {
      report(TABLE_SAVE_LABELS.location_points, 'exporting');
      await yieldToUi();
      const streamed = await streamLocationPointsToJsonFile(
        filePath,
        (done, total) => {
          const tableFraction = done / Math.max(total, 1);
          // Location history is the bulk of DB work — map into write progress.
          const dbShare = estimatedDbBytes / Math.max(estimatedWriteTotal, 1);
          report(
            `Saving location history (${done.toLocaleString()}/${total.toLocaleString()})`,
            'exporting',
            Math.min(0.85, tableFraction * dbShare + 0.05),
          );
        },
      );
      writtenBytes += streamed.bytes;
      continue;
    }

    const rows = bundle.tables[tableName];
    report(TABLE_SAVE_LABELS[tableName], 'exporting');
    await yieldToUi();
    const bytes = await writeJsonArrayFile(filePath, rows, (done, total) => {
      report(
        `${TABLE_SAVE_LABELS[tableName]} (${done.toLocaleString()}/${total.toLocaleString()})`,
        'exporting',
      );
    });
    writtenBytes += bytes;
    report(TABLE_SAVE_LABELS[tableName], 'exporting');
    await yieldToUi();
  }

  await writeText(
    `${directoryPath}/db/trip_overrides.json`,
    JSON.stringify(bundle.tripOverrides, null, 0),
    'Saving visit labels',
  );

  for (let index = 0; index < bundle.mediaFiles.length; index += 1) {
    const file = bundle.mediaFiles[index]!;
    const destination = `${directoryPath}/media/${file.relativePath.replace(
      /^moments\//,
      '',
    )}`;
    const destinationDir = destination.slice(0, destination.lastIndexOf('/'));
    if (destinationDir.length > 0) {
      await ensureDirectory(destinationDir);
    }
    await fs.cp(file.absolutePath, destination);
    writtenBytes += file.bytes;
    report(
      `Copying memories (${index + 1}/${bundle.mediaFiles.length})`,
      'copying_media',
    );
    await yieldToUi();
  }

  onProgress?.({
    phase: 'copying_media',
    message: 'Copying memories',
    ...bytesForPhaseFraction(progressRange, 1),
  });

  return writtenBytes;
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

  const manifestRaw = await fs.readFile(
    `${directoryPath}/manifest.json`,
    'utf8',
  );
  const manifest = JSON.parse(manifestRaw) as BackupManifest;
  if (manifest.format !== 'lifemap-backup') {
    throw new Error('Unsupported backup format.');
  }
  if (manifest.formatVersion > BACKUP_FORMAT_VERSION) {
    throw new Error('This backup requires a newer version of LifeMap.');
  }

  const tableWeights = BACKUP_TABLE_NAMES.map(name =>
    Math.max(manifest.tableCounts[name] ?? 0, 1),
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
    const raw = await fs.readFile(
      `${directoryPath}/db/${tableName}.json`,
      'utf8',
    );
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

  return { manifest, tables, tripOverrides };
}
