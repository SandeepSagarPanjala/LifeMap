import ReactNativeBlobUtil from 'react-native-blob-util';
import {Platform} from 'react-native';

import {getAppVersionLabel} from '@/lib/app-version';

import {
  prepareBackupBundle,
  writeBackupBundleToDirectory,
} from './backup-export';
import {hasLocalUserData} from './backup-clear';
import {
  getBackupStagingDirectory,
  getCloudBackupMetadata,
  getCloudProviderLabel,
  isCloudBackupAvailable,
  uploadBackupDirectory,
} from './native-backup-cloud';
import {prepareEmptyDirectory, removeDirectoryRecursive} from './backup-fs';
import {
  getBackupAutoSchedule,
  isBackupDue,
  getBackupLastAt,
  recordBackupCompletion,
} from './backup-settings';
import type {BackupProgress, CloudBackupMetadata} from './backup-types';

export type BackupStatus = {
  cloudAvailable: boolean;
  cloudProviderLabel: string;
  cloudBackup: CloudBackupMetadata | null;
  lastBackupAt: Date | null;
  lastBackupBytes: number;
  autoSchedule: Awaited<ReturnType<typeof getBackupAutoSchedule>>;
};

export async function getBackupStatus(): Promise<BackupStatus> {
  const [cloudAvailable, cloudBackup, lastBackupAt, autoSchedule] =
    await Promise.all([
      isCloudBackupAvailable(),
      getCloudBackupMetadata(),
      getBackupLastAt(),
      getBackupAutoSchedule(),
    ]);

  const {getBackupLastBytes} = await import('./backup-settings');
  const lastBackupBytes = await getBackupLastBytes();

  return {
    cloudAvailable,
    cloudProviderLabel: getCloudProviderLabel(),
    cloudBackup,
    lastBackupAt,
    lastBackupBytes,
    autoSchedule,
  };
}

async function computeDirectoryBytes(directoryPath: string): Promise<number> {
  const fs = ReactNativeBlobUtil.fs;
  if (!(await fs.exists(directoryPath))) {
    return 0;
  }

  let total = 0;
  async function walk(relativePath: string): Promise<void> {
    const absolutePath = relativePath
      ? `${directoryPath}/${relativePath}`
      : directoryPath;
    const entries = await fs.ls(absolutePath);
    for (const entry of entries) {
      const childRelative = relativePath ? `${relativePath}/${entry}` : entry;
      const childPath = `${directoryPath}/${childRelative}`;
      const stat = await fs.stat(childPath);
      if (stat.type === 'directory') {
        await walk(childRelative);
      } else {
        total += Number(stat.size ?? 0);
      }
    }
  }

  await walk('');
  return total;
}

export async function runBackupNow(
  onProgress?: (progress: BackupProgress) => void,
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

  onProgress?.({
    phase: 'uploading',
    message: `Uploading to ${getCloudProviderLabel()}…`,
  });
  await uploadBackupDirectory(stagingPath);
  await recordBackupCompletion(totalBytes);
  const {hasLocalUserData} = await import('./backup-clear');
  const {markRestoreCompleted} = await import('./backup-install-state');
  if (await hasLocalUserData()) {
    await markRestoreCompleted();
  }
  await removeDirectoryRecursive(stagingPath);

  return {totalBytes};
}

export async function maybeRunScheduledBackup(): Promise<boolean> {
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') {
    return false;
  }

  const schedule = await getBackupAutoSchedule();
  const lastAt = await getBackupLastAt();
  if (!isBackupDue(schedule, lastAt)) {
    return false;
  }

  const hasData = await hasLocalUserData();
  if (!hasData) {
    return false;
  }

  await runBackupNow();
  return true;
}

export async function isWiFiConnected(): Promise<boolean> {
  // Best-effort: react-native-blob-util doesn't expose network type reliably.
  // Scheduled backups run on foreground when due; user footnote mentions Wi-Fi.
  return true;
}
