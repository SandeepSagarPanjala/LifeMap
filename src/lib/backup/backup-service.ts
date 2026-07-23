import ReactNativeBlobUtil from 'react-native-blob-util';
import { Platform } from 'react-native';

import { getAppVersionLabel } from '@/lib/app-version';

import {
  prepareBackupBundle,
  writeBackupBundleToDirectory,
  estimateLocalBackupBytes,
} from './backup-export';
import { hasLocalUserData } from './backup-clear';
import {
  prepareEmptyDirectory,
  removeDirectoryRecursive,
} from './backup-fs';
import {
  getBackupAutoSchedule,
  isBackupDue,
  getBackupLastAt,
  markBackupInProgress,
  clearBackupInProgress,
  recordBackupCompletion,
  recordBackupSkip,
  clearInterruptedBackupIfNeeded,
} from './backup-settings';
import {
  getBackupStagingDirectory,
  getCloudBackupMetadataForOperation,
  getCloudProviderLabel,
  isCloudBackupAvailable,
  uploadBackupDirectory,
} from './native-backup-cloud';
import type { BackupProgress, CloudBackupMetadata } from './backup-types';

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

  return { cloudBackup, localEstimateBytes: localBaselineBytes };
}

/**
 * Local prepare/write is ~half the work; cloud upload is the other half when
 * we cannot stream native upload bytes.
 */
function reportProgress(
  onProgress: ((progress: BackupProgress) => void) | undefined,
  progress: BackupProgress,
): void {
  onProgress?.(progress);
}

export async function runBackupNow(
  onProgress?: (progress: BackupProgress) => void,
): Promise<{ totalBytes: number }> {
  await markBackupInProgress();
  const stagingPath = getBackupStagingDirectory();

  try {
    const estimatedBytes = Math.max(await estimateLocalBackupBytes(), 1);
    const prepareSpan = Math.round(estimatedBytes * 0.3);
    const writeSpan = Math.max(estimatedBytes - prepareSpan, 1);

    reportProgress(onProgress, {
      phase: 'exporting',
      message: 'Preparing your map data',
      completedBytes: 0,
      totalBytes: estimatedBytes,
    });

    const bundle = await prepareBackupBundle(
      await getAppVersionLabel(),
      onProgress,
      {
        baseCompletedBytes: 0,
        phaseSpanBytes: prepareSpan,
        totalBytes: estimatedBytes,
      },
    );

    await prepareEmptyDirectory(stagingPath);

    const writtenBytes = await writeBackupBundleToDirectory(
      bundle,
      stagingPath,
      onProgress,
      {
        baseCompletedBytes: prepareSpan,
        phaseSpanBytes: writeSpan,
        totalBytes: estimatedBytes,
      },
    );

    const totalBytes = Math.max(writtenBytes, 1);
    bundle.manifest.totalBytes = totalBytes;

    await ReactNativeBlobUtil.fs.writeFile(
      `${stagingPath}/manifest.json`,
      JSON.stringify(bundle.manifest, null, 2),
      'utf8',
    );

    const provider = getCloudProviderLabel();
    reportProgress(onProgress, {
      phase: 'uploading',
      message: `Uploading to ${provider}`,
      completedBytes: Math.round(totalBytes * 0.92),
      totalBytes,
    });

    // Soft progress while native upload has no byte callbacks.
    let uploadTick = 0;
    const uploadPulse = setInterval(() => {
      uploadTick += 1;
      const pulsed = Math.min(
        totalBytes - 1,
        Math.round(totalBytes * (0.92 + Math.min(uploadTick, 20) * 0.003)),
      );
      reportProgress(onProgress, {
        phase: 'uploading',
        message: `Uploading to ${provider}`,
        completedBytes: pulsed,
        totalBytes,
      });
    }, 1_000);

    try {
      await uploadBackupDirectory(stagingPath);
    } finally {
      clearInterval(uploadPulse);
    }

    reportProgress(onProgress, {
      phase: 'uploading',
      message: 'Backup complete',
      completedBytes: totalBytes,
      totalBytes,
    });

    await recordBackupCompletion(totalBytes);
    const { markRestoreCompleted } = await import('./backup-install-state');
    if (await hasLocalUserData()) {
      await markRestoreCompleted();
    }

    return { totalBytes };
  } catch (error) {
    await clearBackupInProgress().catch(() => undefined);
    throw error;
  } finally {
    await removeDirectoryRecursive(stagingPath).catch(() => undefined);
  }
}

export async function isScheduledBackupDue(): Promise<boolean> {
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') {
    return false;
  }

  await clearInterruptedBackupIfNeeded();

  const schedule = await getBackupAutoSchedule();
  const lastAt = await getBackupLastAt();
  if (!isBackupDue(schedule, lastAt)) {
    return false;
  }

  return hasLocalUserData();
}

export async function skipScheduledBackup(): Promise<void> {
  await recordBackupSkip();
}

export async function maybeRunScheduledBackup(
  onProgress?: (progress: BackupProgress) => void,
): Promise<boolean> {
  if (!(await isScheduledBackupDue())) {
    return false;
  }

  try {
    await runBackupNow(onProgress);
    return true;
  } catch {
    // Don't leave the user stuck retrying every foreground — skip this window.
    await recordBackupSkip().catch(() => undefined);
    return false;
  }
}

export async function isWiFiConnected(): Promise<boolean> {
  // Best-effort: react-native-blob-util doesn't expose network type reliably.
  // Scheduled backups run on foreground when due; user footnote mentions Wi-Fi.
  return true;
}
