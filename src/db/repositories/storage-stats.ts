import ReactNativeBlobUtil from 'react-native-blob-util';

import {
  momentTypeLabel,
  MOMENT_STORAGE_TYPE_ORDER,
  sumBreakdownBytes,
  type StorageBreakdownItem,
} from '@/lib/app-storage-breakdown';
import {
  getDocumentDirectory,
  momentStorageRelativePath,
  resolveMomentContentPath,
} from '@/lib/moments/moment-media-uri';
import { MOMENTS_TMP_DIRECTORY } from '@/lib/moments/moment-storage';
import { notePhotoAttachmentPaths } from '@/lib/moments/note-photo-attachments';

import { computeDatabaseFileStats } from '@/lib/database-file-stats';

import { getSqlite } from '../client';
import { getAllMoments, type MomentRow, type MomentType } from './moments';

export type AppStorageBreakdown = {
  items: StorageBreakdownItem[];
  totalBytes: number;
  databaseFreeBytes: number;
};

export type DatabaseFileStats = {
  totalBytes: number;
  freeBytes: number;
  usedBytes: number;
};

function pragmaNumber(
  rows: Array<Record<string, unknown>> | undefined,
  key: string,
): number {
  const row = rows?.[0];
  if (!row) {
    return 0;
  }

  const named = row[key];
  if (named != null) {
    return Number(named);
  }

  const firstValue = Object.values(row)[0];
  return firstValue != null ? Number(firstValue) : 0;
}

async function readDatabaseFileStats(): Promise<DatabaseFileStats> {
  const sqlite = await getSqlite();
  const [pageCountResult, pageSizeResult, freelistResult] = await Promise.all([
    sqlite.execute('PRAGMA page_count'),
    sqlite.execute('PRAGMA page_size'),
    sqlite.execute('PRAGMA freelist_count'),
  ]);
  return computeDatabaseFileStats(
    pragmaNumber(pageCountResult.rows, 'page_count'),
    pragmaNumber(pageSizeResult.rows, 'page_size'),
    pragmaNumber(freelistResult.rows, 'freelist_count'),
  );
}

export async function getDatabaseFileStats(): Promise<DatabaseFileStats> {
  return readDatabaseFileStats();
}

export async function getDatabaseFileBytes(): Promise<number> {
  const stats = await readDatabaseFileStats();
  return stats.totalBytes;
}

export async function vacuumDatabase(): Promise<{
  beforeBytes: number;
  afterBytes: number;
  reclaimedBytes: number;
}> {
  const beforeBytes = await getDatabaseFileBytes();
  const sqlite = await getSqlite();
  await sqlite.execute('VACUUM');
  const afterBytes = await getDatabaseFileBytes();
  return {
    beforeBytes,
    afterBytes,
    reclaimedBytes: Math.max(0, beforeBytes - afterBytes),
  };
}

type ListedFile = {
  relativePath: string;
  bytes: number;
};

async function listMomentDirectoryFiles(
  relativeDirectory: string,
): Promise<ListedFile[]> {
  try {
    const absoluteDirectory = `${getDocumentDirectory()}/${relativeDirectory}`;
    const exists = await ReactNativeBlobUtil.fs.exists(absoluteDirectory);
    if (!exists) {
      return [];
    }

    const names = await ReactNativeBlobUtil.fs.ls(absoluteDirectory);
    const files: ListedFile[] = [];

    for (const name of names) {
      const absolutePath = `${absoluteDirectory}/${name}`;
      const stat = await ReactNativeBlobUtil.fs.stat(absolutePath);
      if (stat.type === 'directory') {
        continue;
      }
      files.push({
        relativePath: `${relativeDirectory}/${name}`,
        bytes: stat.size ?? 0,
      });
    }

    return files;
  } catch {
    return [];
  }
}

async function resolveMomentFileBytes(moment: MomentRow): Promise<number> {
  if (!moment.contentPath) {
    return 0;
  }

  try {
    const path = resolveMomentContentPath(moment.contentPath);
    const exists = await ReactNativeBlobUtil.fs.exists(path);
    if (exists) {
      const stat = await ReactNativeBlobUtil.fs.stat(path);
      return stat.size ?? moment.contentBytes ?? 0;
    }
  } catch {
    // Fall through to stored metadata.
  }
  return moment.contentBytes ?? 0;
}

function referencedMomentPaths(moments: MomentRow[]): Set<string> {
  const paths = new Set<string>();
  for (const moment of moments) {
    for (const path of notePhotoAttachmentPaths(moment)) {
      const relative = momentStorageRelativePath(path);
      if (relative) {
        paths.add(relative);
      }
    }
    if (moment.voiceAttachmentPath) {
      const relative = momentStorageRelativePath(moment.voiceAttachmentPath);
      if (relative) {
        paths.add(relative);
      }
    }
  }
  return paths;
}

async function groupMomentStorageByType(
  allMoments: MomentRow[],
): Promise<StorageBreakdownItem[]> {
  const grouped = new Map<MomentType, { count: number; bytes: number }>();
  for (const type of MOMENT_STORAGE_TYPE_ORDER) {
    grouped.set(type, { count: 0, bytes: 0 });
  }

  for (const moment of allMoments) {
    const entry = grouped.get(moment.type) ?? { count: 0, bytes: 0 };
    entry.count += 1;
    entry.bytes += await resolveMomentFileBytes(moment);
    grouped.set(moment.type, entry);
  }

  return MOMENT_STORAGE_TYPE_ORDER.filter(
    type => (grouped.get(type)?.count ?? 0) > 0,
  ).map(type => {
    const entry = grouped.get(type)!;
    return {
      key: `moments-${type}`,
      label: momentTypeLabel(type),
      count: entry.count,
      bytes: entry.bytes,
      category: 'moment' as const,
    };
  });
}

export async function getAppStorageBreakdown(): Promise<AppStorageBreakdown> {
  const [databaseStats, allMoments] = await Promise.all([
    readDatabaseFileStats(),
    getAllMoments(),
  ]);
  const databaseBytes = databaseStats.totalBytes;

  const items: StorageBreakdownItem[] = [
    {
      key: 'database',
      label: 'DB',
      count: null,
      bytes: databaseBytes,
      category: 'database',
    },
  ];

  let momentItems: StorageBreakdownItem[] = [];
  let orphanFiles: ListedFile[] = [];
  let tempFiles: ListedFile[] = [];

  try {
    momentItems = await groupMomentStorageByType(allMoments);

    const referencedPaths = referencedMomentPaths(allMoments);
    const momentFiles = await listMomentDirectoryFiles('moments');
    orphanFiles = momentFiles.filter(
      file => !referencedPaths.has(file.relativePath),
    );
    tempFiles = await listMomentDirectoryFiles(
      `moments/${MOMENTS_TMP_DIRECTORY}`,
    );
  } catch {
    if (allMoments.length > 0) {
      momentItems = MOMENT_STORAGE_TYPE_ORDER.flatMap(type => {
        const typed = allMoments.filter(moment => moment.type === type);
        if (typed.length === 0) {
          return [];
        }
        const bytes = typed.reduce(
          (sum, moment) => sum + (moment.contentBytes ?? 0),
          0,
        );
        return [
          {
            key: `moments-${type}`,
            label: momentTypeLabel(type),
            count: typed.length,
            bytes,
            category: 'moment' as const,
          },
        ];
      });
    }
  }

  items.push(...momentItems);

  const orphanBytes = sumBreakdownBytes(orphanFiles);
  if (orphanBytes > 0) {
    items.push({
      key: 'orphan-moment-files',
      label: 'Orphan moment files',
      count: orphanFiles.length,
      bytes: orphanBytes,
      category: 'other',
    });
  }

  const tempBytes = sumBreakdownBytes(tempFiles);
  if (tempBytes > 0) {
    items.push({
      key: 'moment-temp',
      label: 'Moment temp files',
      count: tempFiles.length,
      bytes: tempBytes,
      category: 'other',
    });
  }

  const totalBytes =
    databaseBytes + sumBreakdownBytes(momentItems) + orphanBytes + tempBytes;
  const totalCount =
    momentItems.reduce((sum, item) => sum + (item.count ?? 0), 0) +
    orphanFiles.length +
    tempFiles.length;
  items.push({
    key: 'all',
    label: 'All',
    count: totalCount,
    bytes: totalBytes,
    category: 'total',
  });

  return {
    items,
    totalBytes,
    databaseFreeBytes: databaseStats.freeBytes,
  };
}
