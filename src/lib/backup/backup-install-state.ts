import AsyncStorage from '@react-native-async-storage/async-storage';

import {getCloudBackupMetadata} from './native-backup-cloud';
import type {CloudBackupMetadata} from './backup-types';

const INSTALL_SNAPSHOT_KEY = 'lifemap-install-cloud-backup-snapshot';
const RESTORE_COMPLETED_KEY = 'lifemap-backup-restore-completed';
const INSTALL_RESTORE_PRESENTED_KEY = 'lifemap-install-restore-presented';

export type InstallCloudBackupSnapshot = CloudBackupMetadata & {
  detectedAt: string;
};

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

export async function getInstallCloudBackupSnapshot(): Promise<InstallCloudBackupSnapshot | null> {
  const raw = await AsyncStorage.getItem(INSTALL_SNAPSHOT_KEY);
  if (!raw) {
    return null;
  }
  return JSON.parse(raw) as InstallCloudBackupSnapshot;
}

/** Fast metadata for the restore offer UI — does not download the full backup. */
export async function loadRestoreOfferMetadata(): Promise<InstallCloudBackupSnapshot | CloudBackupMetadata | null> {
  const [snapshot, cloudMetadata] = await Promise.all([
    getInstallCloudBackupSnapshot(),
    getCloudBackupMetadata(),
  ]);

  if (!snapshot?.exportedAt && !cloudMetadata?.exportedAt) {
    return null;
  }
  if (!snapshot?.exportedAt) {
    return cloudMetadata;
  }
  if (!cloudMetadata?.exportedAt) {
    return snapshot;
  }

  const snapshotTime = new Date(snapshot.exportedAt).getTime();
  const cloudTime = new Date(cloudMetadata.exportedAt).getTime();
  if (!Number.isFinite(snapshotTime)) {
    return cloudMetadata;
  }
  if (!Number.isFinite(cloudTime)) {
    return snapshot;
  }

  return cloudTime >= snapshotTime ? cloudMetadata : snapshot;
}

export async function hasInstallCloudBackup(): Promise<boolean> {
  return (await getInstallCloudBackupSnapshot()) != null;
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
  const {hasLocalUserData} = await import('./backup-clear');
  if (await hasLocalUserData()) {
    return false;
  }
  return hasInstallCloudBackup();
}

export async function dismissInstallRestoreOffer(): Promise<void> {
  await AsyncStorage.setItem('lifemap-backup-restore-prompt', 'dismissed');
}

export async function wasInstallRestoreDismissed(): Promise<boolean> {
  return (await AsyncStorage.getItem('lifemap-backup-restore-prompt')) === 'dismissed';
}

/** Settings: offer restore only when this install found iCloud data and local DB is still empty. */
export async function shouldShowSettingsRestore(): Promise<boolean> {
  if (await isRestoreCompleted()) {
    return false;
  }
  if (!(await hasInstallCloudBackup())) {
    return false;
  }
  const {hasLocalUserData} = await import('./backup-clear');
  return !(await hasLocalUserData());
}
