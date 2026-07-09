import { sql } from 'drizzle-orm';
import ReactNativeBlobUtil from 'react-native-blob-util';

import { getDatabase, getSqlite } from '@/db/client';
import {
  activities,
  locationPoints,
  materializedDays,
  moments,
  placeLookupCache,
  savedPlaces,
  settings,
  settingsStatsCache,
  trackingEvents,
  tripPoints,
  trips,
} from '@/db/schema';
import { getDocumentDirectory } from '@/lib/moments/moment-media-uri';
import {
  ensureMomentsDirectory,
  ensureMomentsTempDirectory,
} from '@/lib/moments/moment-storage';

import { ensureDirectory, yieldToUi } from './backup-fs';
import type { BackupProgress } from './backup-types';

export async function clearAllUserData(): Promise<void> {
  const db = await getDatabase();
  await db.transaction(async tx => {
    await tx.delete(tripPoints);
    await tx.delete(trips);
    await tx.delete(materializedDays);
    await tx.delete(moments);
    await tx.delete(trackingEvents);
    await tx.delete(locationPoints);
    await tx.delete(placeLookupCache);
    await tx.delete(savedPlaces);
    await tx.delete(activities);
    await tx.delete(settings);
    await tx.delete(settingsStatsCache);
  });

  await clearMomentMediaFiles();
}

async function clearMomentMediaFiles(): Promise<void> {
  const fs = ReactNativeBlobUtil.fs;
  const momentsDir = `${getDocumentDirectory()}/moments`;
  if (!(await fs.exists(momentsDir))) {
    return;
  }

  const entries = await fs.ls(momentsDir);
  for (const entry of entries) {
    if (entry === '.tmp') {
      continue;
    }
    const path = `${momentsDir}/${entry}`;
    await fs.unlink(path);
  }
}

export async function hasLocalUserData(): Promise<boolean> {
  const db = await getDatabase();
  const [locationCount, momentCount] = await Promise.all([
    db.select({ count: sql<number>`count(*)` }).from(locationPoints),
    db.select({ count: sql<number>`count(*)` }).from(moments),
  ]);
  return (
    Number(locationCount[0]?.count ?? 0) > 0 ||
    Number(momentCount[0]?.count ?? 0) > 0
  );
}

export async function ensureMomentDirectories(): Promise<void> {
  await ensureMomentsDirectory();
  await ensureMomentsTempDirectory();
}

export async function copyBackupMediaToSandbox(
  backupDirectoryPath: string,
  onProgress?: (progress: BackupProgress) => void,
): Promise<void> {
  const fs = ReactNativeBlobUtil.fs;
  const sourceDir = `${backupDirectoryPath}/media`;
  if (!(await fs.exists(sourceDir))) {
    return;
  }

  await ensureMomentDirectories();
  const docs = getDocumentDirectory();
  const filesToCopy: string[] = [];

  async function collectFiles(relativeDir: string): Promise<void> {
    const absoluteDir =
      relativeDir.length > 0 ? `${sourceDir}/${relativeDir}` : sourceDir;
    const entries = await fs.ls(absoluteDir);
    for (const entry of entries) {
      const entryRelative = relativeDir ? `${relativeDir}/${entry}` : entry;
      const sourcePath = `${sourceDir}/${entryRelative}`;
      const stat = await fs.stat(sourcePath);
      if (stat.type === 'directory') {
        await collectFiles(entryRelative);
        continue;
      }
      filesToCopy.push(entryRelative);
    }
  }

  await collectFiles('');
  const totalFiles = Math.max(filesToCopy.length, 1);

  for (let index = 0; index < filesToCopy.length; index += 1) {
    const entryRelative = filesToCopy[index]!;
    if (index % 10 === 0) {
      onProgress?.({
        phase: 'copying_media',
        message: 'Copying memories…',
        completed: index,
        total: totalFiles,
      });
      await yieldToUi();
    }
    const sourcePath = `${sourceDir}/${entryRelative}`;
    const destination = `${docs}/moments/${entryRelative}`;
    const destinationDir = destination.slice(0, destination.lastIndexOf('/'));
    if (destinationDir.length > 0) {
      await ensureDirectory(destinationDir);
    }
    await fs.cp(sourcePath, destination);
  }

  onProgress?.({
    phase: 'copying_media',
    message: 'Memories copied',
    completed: totalFiles,
    total: totalFiles,
  });
}

export async function resetSqliteAutoIncrementCounters(): Promise<void> {
  const sqlite = await getSqlite();
  const tables = [
    'activities',
    'location_points',
    'saved_places',
    'place_lookup_cache',
    'moments',
    'settings',
    'trips',
    'trip_points',
    'tracking_events',
  ];
  for (const table of tables) {
    await sqlite.execute(`DELETE FROM sqlite_sequence WHERE name = ?`, [table]);
  }
}
