import ReactNativeBlobUtil from 'react-native-blob-util';
import {Platform} from 'react-native';

import {getAppVersionLabel} from '@/lib/app-version';

import {
  prepareBackupBundle,
  writeBackupBundleToDirectory,
  estimateLocalBackupBytes,
} from './backup-export';
import {hasLocalUserData} from './backup-clear';
import {
  getBackupStagingDirectory,
  getCloudBackupMetadataForOperation,
  getCloudProviderLabel,
  isCloudBackupAvailable,
  uploadBackupDirectory,
} from './native-backup-cloud';
import {
  computeDirectoryBytes,
  prepareEmptyDirectory,
  removeDirectoryRecursive,
} from './backup-fs';
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
  const [cloudAvailable, lastBackupAt, autoSchedule, lastBackupBytes] =
    await Promise.all([
      isCloudBackupAvailable(),
      getBackupLastAt(),
      getBackupAutoSchedule(),
      import('./backup-settings').then(m => m.getBackupLastBytes()),
    ]);

  return {
    cloudAvailable,
    cloudProviderLabel: getCloudProviderLabel(),
    cloudBackup: null,
    lastBackupAt,
    lastBackupBytes,
    autoSchedule,
  };
}

export type BackupSizeWarning = {
  cloudBytes: number;
  localEstimateBytes: number;
};

export async function getExistingCloudBackup(): Promise<CloudBackupMetadata | null> {
  const metadata = await getCloudBackupMetadataForOperation();
  if (!metadata?.exportedAt) {
    return null;
  }
  return metadata;
}

/** @deprecated Use shouldPromptBeforeCloudBackupReplace — kept for tests. */
export async function getBackupSizeWarning(): Promise<BackupSizeWarning | null> {
  const prompt = await shouldPromptBeforeCloudBackupReplace();
  if (prompt == null) {
    return null;
  }
  return {
    cloudBytes: prompt.cloudBackup.totalBytes,
    localEstimateBytes: prompt.localEstimateBytes,
  };
}

/**
 * Prompt before replacing iCloud backup when the cloud copy is meaningfully
 * larger than what this phone would upload now.
 */
export async function shouldPromptBeforeCloudBackupReplace(): Promise<{
  cloudBackup: CloudBackupMetadata;
  localEstimateBytes: number;
} | null> {
  const [cloudBackup, localEstimateBytes, lastBackupBytes] = await Promise.all([
    getExistingCloudBackup(),
    estimateLocalBackupBytes(),
    import('./backup-settings').then(m => m.getBackupLastBytes()),
  ]);

  if (!cloudBackup?.exportedAt) {
    return null;
  }

  const cloudBytes = cloudBackup.totalBytes;
  if (cloudBytes <= 0) {
    return null;
  }

  const localBaselineBytes = Math.max(localEstimateBytes, lastBackupBytes);
  if (cloudBytes <= localBaselineBytes * 1.05) {
    return null;
  }

  return {cloudBackup, localEstimateBytes: localBaselineBytes};
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

export async function maybeRunScheduledBackup(
  onProgress?: (progress: BackupProgress) => void,
): Promise<boolean> {
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

  onProgress?.({phase: 'exporting', message: 'Starting automatic backup…'});
  await runBackupNow(onProgress);
  return true;
}

export async function isWiFiConnected(): Promise<boolean> {
  // Best-effort: react-native-blob-util doesn't expose network type reliably.
  // Scheduled backups run on foreground when due; user footnote mentions Wi-Fi.
  return true;
}
