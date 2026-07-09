import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  getCloudBackupMetadata,
  getCloudBackupMetadataForOperation,
  withTimeout,
} from './native-backup-cloud';
import type { CloudBackupMetadata } from './backup-types';

const INSTALL_SNAPSHOT_KEY = 'lifemap-install-cloud-backup-snapshot';
const RESTORE_COMPLETED_KEY = 'lifemap-backup-restore-completed';
const INSTALL_RESTORE_PRESENTED_KEY = 'lifemap-install-restore-presented';

export type InstallCloudBackupSnapshot = CloudBackupMetadata & {
  detectedAt: string;
};

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => {
    setTimeout(resolve, ms);
  });
}

export async function captureInstallCloudBackupSnapshot(): Promise<InstallCloudBackupSnapshot | null> {
  const existing = await AsyncStorage.getItem(INSTALL_SNAPSHOT_KEY);
  if (existing) {
    return JSON.parse(existing) as InstallCloudBackupSnapshot;
  }

  const metadata = await getCloudBackupMetadata();
  if (!metadata?.exportedAt) {
    return null;
  }

  const snapshot: InstallCloudBackupSnapshot = {
    ...metadata,
    detectedAt: new Date().toISOString(),
  };
  await AsyncStorage.setItem(INSTALL_SNAPSHOT_KEY, JSON.stringify(snapshot));
  return snapshot;
}

/** iCloud can be slow right after install — retry before giving up on restore offer. */
export async function captureInstallCloudBackupSnapshotWithRetry(): Promise<InstallCloudBackupSnapshot | null> {
  const existing = await getInstallCloudBackupSnapshot();
  if (existing != null) {
    return existing;
  }

  const retryDelaysMs = [0, 2_000, 5_000, 10_000];
  for (const delayMs of retryDelaysMs) {
    if (delayMs > 0) {
      await sleep(delayMs);
    }
    const snapshot = await captureInstallCloudBackupSnapshot();
    if (snapshot != null) {
      return snapshot;
    }
  }
  return null;
}

export async function getInstallCloudBackupSnapshot(): Promise<InstallCloudBackupSnapshot | null> {
  const raw = await AsyncStorage.getItem(INSTALL_SNAPSHOT_KEY);
  if (!raw) {
    return null;
  }
  return JSON.parse(raw) as InstallCloudBackupSnapshot;
}

export async function loadRestoreOfferMetadata(): Promise<
  InstallCloudBackupSnapshot | CloudBackupMetadata | null
> {
  const snapshot = await getInstallCloudBackupSnapshot();
  if (snapshot?.exportedAt) {
    return snapshot;
  }
  return getCloudBackupMetadataForOperation();
}

export async function hasRecoverableCloudBackup(): Promise<boolean> {
  const snapshot = await getInstallCloudBackupSnapshot();
  if (snapshot?.exportedAt) {
    return true;
  }
  const metadata = await withTimeout(getCloudBackupMetadata(), 8_000, null);
  return metadata?.exportedAt != null;
}

export async function hasInstallCloudBackup(): Promise<boolean> {
  return hasRecoverableCloudBackup();
}

export async function isRestoreCompleted(): Promise<boolean> {
  return (await AsyncStorage.getItem(RESTORE_COMPLETED_KEY)) === 'true';
}

export async function markRestoreCompleted(): Promise<void> {
  await AsyncStorage.setItem(RESTORE_COMPLETED_KEY, 'true');
  await AsyncStorage.setItem('lifemap-backup-restore-prompt', 'restored');
}

export async function markInstallRestorePresented(): Promise<void> {
  await AsyncStorage.setItem(INSTALL_RESTORE_PRESENTED_KEY, 'true');
}

/** Fresh install: cloud backup exists, local DB still empty, restore not handled yet. */
export async function shouldAutoNavigateToRestore(): Promise<boolean> {
  if (await isRestoreCompleted()) {
    return false;
  }
  if (await wasInstallRestoreDismissed()) {
    return false;
  }
  if ((await AsyncStorage.getItem(INSTALL_RESTORE_PRESENTED_KEY)) === 'true') {
    return false;
  }
  const { hasLocalUserData } = await import('./backup-clear');
  if (await hasLocalUserData()) {
    return false;
  }
  return hasRecoverableCloudBackup();
}

export async function dismissInstallRestoreOffer(): Promise<void> {
  await AsyncStorage.setItem('lifemap-backup-restore-prompt', 'dismissed');
}

export async function wasInstallRestoreDismissed(): Promise<boolean> {
  return (
    (await AsyncStorage.getItem('lifemap-backup-restore-prompt')) ===
    'dismissed'
  );
}

/** Settings: show restore while a cloud backup exists and restore has not completed. */
export async function shouldShowSettingsRestore(): Promise<boolean> {
  if (await isRestoreCompleted()) {
    return false;
  }
  return hasRecoverableCloudBackup();
}

export async function cloudBackupExistsForLaunchInit(): Promise<boolean> {
  const snapshot = await getInstallCloudBackupSnapshot();
  if (snapshot?.exportedAt) {
    return true;
  }
  const metadata = await withTimeout(getCloudBackupMetadata(), 5_000, null);
  return metadata?.exportedAt != null;
}
