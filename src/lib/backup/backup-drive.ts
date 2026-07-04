import {format} from 'date-fns';
import {APP_COPY, errorMessageOr} from '@/lib/app-copy';
import {InteractionManager, Platform, Share} from 'react-native';
import ReactNativeBlobUtil from 'react-native-blob-util';
import {
  errorCodes,
  isErrorWithCode,
  keepLocalCopy,
  pick,
  types,
} from '@react-native-documents/picker';
import {unzip, zip} from 'react-native-zip-archive';

import {getAppVersionLabel} from '@/lib/app-version';
import {formatStorageBytes} from '@/lib/format-storage';

import {
  prepareBackupBundle,
  readBackupBundleFromDirectory,
  writeBackupBundleToDirectory,
} from './backup-export';
import {computeDirectoryBytes, prepareEmptyDirectory, removeDirectoryRecursive} from './backup-fs';
import {getBackupStagingDirectory} from './native-backup-cloud';
import type {BackupProgress, CloudBackupMetadata} from './backup-types';

const DRIVE_ZIP_PREFIX = 'lifemap-backup';
const DRIVE_RESTORE_STAGING = 'lifemap-drive-restore-staging';

let pendingDriveRestoreStagingPath: string | null = null;
let pendingDriveRestoreMetadata: CloudBackupMetadata | null = null;

export function getPendingDriveRestoreOffer(): {
  stagingPath: string;
  metadata: CloudBackupMetadata;
} | null {
  if (!pendingDriveRestoreStagingPath || !pendingDriveRestoreMetadata) {
    return null;
  }
  return {
    stagingPath: pendingDriveRestoreStagingPath,
    metadata: pendingDriveRestoreMetadata,
  };
}

export function clearPendingDriveRestore(): void {
  const stagingPath = pendingDriveRestoreStagingPath;
  pendingDriveRestoreStagingPath = null;
  pendingDriveRestoreMetadata = null;
  if (stagingPath) {
    void removeDirectoryRecursive(stagingPath);
  }
}

function buildDriveBackupFilename(exportedAt: string): string {
  const stamp = format(new Date(exportedAt), 'yyyy-MM-dd-HHmm');
  return `${DRIVE_ZIP_PREFIX}-${stamp}.zip`;
}

function getDriveRestoreStagingPath(): string {
  return `${ReactNativeBlobUtil.fs.dirs.CacheDir}/${DRIVE_RESTORE_STAGING}`;
}

export async function exportBackupToDrive(
  onProgress?: (progress: BackupProgress | null) => void,
): Promise<{totalBytes: number}> {
  onProgress?.({phase: 'exporting', message: 'Exporting your data…'});
  const bundle = await prepareBackupBundle(await getAppVersionLabel());
  const stagingPath = getBackupStagingDirectory();
  await prepareEmptyDirectory(stagingPath);

  onProgress?.({phase: 'copying_media', message: 'Copying memories…'});
  await writeBackupBundleToDirectory(bundle, stagingPath);
  const totalBytes = await computeDirectoryBytes(stagingPath);
  bundle.manifest.totalBytes = totalBytes;

  await ReactNativeBlobUtil.fs.writeFile(
    `${stagingPath}/manifest.json`,
    JSON.stringify(bundle.manifest, null, 2),
    'utf8',
  );

  const filename = buildDriveBackupFilename(bundle.manifest.exportedAt);
  const zipPath = `${ReactNativeBlobUtil.fs.dirs.CacheDir}/${filename}`;

  try {
    onProgress?.({phase: 'uploading', message: 'Creating backup file…'});
    if (await ReactNativeBlobUtil.fs.exists(zipPath)) {
      await ReactNativeBlobUtil.fs.unlink(zipPath);
    }
    await zip(stagingPath, zipPath);

    onProgress?.(null);
    const shareUrl = Platform.OS === 'ios' ? zipPath : `file://${zipPath}`;
    await Share.share({
      title: filename,
      message: `LifeMap backup (${formatStorageBytes(totalBytes)})`,
      url: shareUrl,
    });

    return {totalBytes};
  } finally {
    await removeDirectoryRecursive(stagingPath);
  }
}

async function pickBackupZipFile() {
  await new Promise<void>(resolve => {
    InteractionManager.runAfterInteractions(() => resolve());
  });
  const [picked] = await pick({
    type: [types.zip, 'application/zip', 'application/x-zip-compressed'],
  });
  return picked;
}

export async function pickAndStageDriveBackup(
  onProgress?: (progress: BackupProgress) => void,
): Promise<{
  stagingPath: string;
  metadata: CloudBackupMetadata;
} | null> {
  try {
    const picked = await pickBackupZipFile();

    onProgress?.({phase: 'downloading', message: 'Copying backup file…'});
    const [localCopy] = await keepLocalCopy({
      files: [
        {
          uri: picked.uri,
          fileName: picked.name ?? 'lifemap-backup.zip',
        },
      ],
      destination: 'cachesDirectory',
    });

    if (localCopy.status !== 'success') {
      throw new Error(
        localCopy.copyError ?? APP_COPY.alerts.couldNotReadBackupFile,
      );
    }

    const stagingPath = getDriveRestoreStagingPath();
    await prepareEmptyDirectory(stagingPath);

    onProgress?.({phase: 'downloading', message: 'Extracting backup…'});
    await unzip(localCopy.localUri, stagingPath);

    const {manifest} = await readBackupBundleFromDirectory(stagingPath);
    const metadata: CloudBackupMetadata = {
      exportedAt: manifest.exportedAt,
      totalBytes: manifest.totalBytes,
      formatVersion: manifest.formatVersion,
    };

    pendingDriveRestoreStagingPath = stagingPath;
    pendingDriveRestoreMetadata = metadata;

    return {stagingPath, metadata};
  } catch (error) {
    if (isErrorWithCode(error) && error.code === errorCodes.OPERATION_CANCELED) {
      return null;
    }
    throw error;
  }
}
