import { NativeModules, Platform } from 'react-native';
import ReactNativeBlobUtil from 'react-native-blob-util';

import type { CloudBackupMetadata } from './backup-types';
import { removeDirectoryRecursive } from './backup-fs';

type BackupCloudNativeModule = {
  isCloudAvailable(): Promise<boolean>;
  getCloudBackupMetadata(): Promise<CloudBackupMetadata | null>;
  uploadBackupDirectory(localDirectoryPath: string): Promise<void>;
  downloadBackupDirectory(localDirectoryPath: string): Promise<void>;
};

const nativeModule = NativeModules.BackupCloudModule as
  | BackupCloudNativeModule
  | undefined;

const ANDROID_BACKUP_ROOT = 'LifeMapBackups';
const BACKUP_SLOT = 'backup';
const LEGACY_CURRENT_SLOT = 'current';
const LEGACY_PREVIOUS_SLOT = 'previous';

function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  fallback: T,
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>(resolve => {
      setTimeout(() => resolve(fallback), timeoutMs);
    }),
  ]);
}

export function withTimeoutReject<T>(
  promise: Promise<T>,
  timeoutMs: number,
  message: string,
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<T>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(message)), timeoutMs);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timeoutId != null) {
      clearTimeout(timeoutId);
    }
  });
}

export { withTimeout };

/** Large media backups can take a while on slow iCloud links. */
export const BACKUP_UPLOAD_TIMEOUT_MS = 10 * 60 * 1000;

function getAndroidBackupDirectory(slot: string): string {
  return `${ReactNativeBlobUtil.fs.dirs.DocumentDir}/${ANDROID_BACKUP_ROOT}/${slot}`;
}

async function readAndroidManifest(
  slot: string,
): Promise<CloudBackupMetadata | null> {
  const manifestPath = `${getAndroidBackupDirectory(slot)}/manifest.json`;
  if (!(await ReactNativeBlobUtil.fs.exists(manifestPath))) {
    return null;
  }
  const manifest = JSON.parse(
    await ReactNativeBlobUtil.fs.readFile(manifestPath, 'utf8'),
  ) as {
    exportedAt?: string;
    totalBytes?: number;
    formatVersion?: number;
  };
  if (!manifest.exportedAt) {
    return null;
  }
  return {
    exportedAt: manifest.exportedAt,
    totalBytes: Number(manifest.totalBytes ?? 0),
    formatVersion: Number(manifest.formatVersion ?? 1),
  };
}

function pickBestMetadata(
  left: CloudBackupMetadata | null,
  right: CloudBackupMetadata | null,
): CloudBackupMetadata | null {
  if (left == null) {
    return right;
  }
  if (right == null) {
    return left;
  }
  const leftTime = new Date(left.exportedAt).getTime();
  const rightTime = new Date(right.exportedAt).getTime();
  if (
    Number.isFinite(leftTime) &&
    Number.isFinite(rightTime) &&
    leftTime !== rightTime
  ) {
    return leftTime >= rightTime ? left : right;
  }
  return left.totalBytes >= right.totalBytes ? left : right;
}

async function resolveAndroidBackupMetadata(): Promise<CloudBackupMetadata | null> {
  const [single, current, previous] = await Promise.all([
    readAndroidManifest(BACKUP_SLOT),
    readAndroidManifest(LEGACY_CURRENT_SLOT),
    readAndroidManifest(LEGACY_PREVIOUS_SLOT),
  ]);
  return pickBestMetadata(single, pickBestMetadata(current, previous));
}

async function resolveAndroidBackupDirectory(): Promise<string | null> {
  const slots = [
    BACKUP_SLOT,
    LEGACY_CURRENT_SLOT,
    LEGACY_PREVIOUS_SLOT,
  ] as const;
  const manifests = await Promise.all(slots.map(readAndroidManifest));
  let bestSlot: (typeof slots)[number] | null = null;
  let bestMetadata: CloudBackupMetadata | null = null;
  for (let index = 0; index < slots.length; index += 1) {
    const metadata = manifests[index] ?? null;
    if (metadata == null) {
      continue;
    }
    if (bestMetadata == null) {
      bestMetadata = metadata;
      bestSlot = slots[index]!;
      continue;
    }
    const picked = pickBestMetadata(bestMetadata, metadata);
    if (picked === metadata) {
      bestMetadata = metadata;
      bestSlot = slots[index]!;
    }
  }
  return bestSlot != null ? getAndroidBackupDirectory(bestSlot) : null;
}

async function androidIsCloudAvailable(): Promise<boolean> {
  return true;
}

async function androidGetCloudBackupMetadata(): Promise<CloudBackupMetadata | null> {
  return resolveAndroidBackupMetadata();
}

async function androidUploadBackupDirectory(
  localDirectoryPath: string,
): Promise<void> {
  const destination = getAndroidBackupDirectory(BACKUP_SLOT);
  if (await ReactNativeBlobUtil.fs.exists(destination)) {
    await removeDirectoryRecursive(destination);
  }
  await ReactNativeBlobUtil.fs.cp(localDirectoryPath, destination);

  for (const legacySlot of [LEGACY_CURRENT_SLOT, LEGACY_PREVIOUS_SLOT]) {
    const legacyPath = getAndroidBackupDirectory(legacySlot);
    if (await ReactNativeBlobUtil.fs.exists(legacyPath)) {
      await removeDirectoryRecursive(legacyPath);
    }
  }
}

async function androidDownloadBackupDirectory(
  localDirectoryPath: string,
): Promise<void> {
  const source = await resolveAndroidBackupDirectory();
  if (source == null) {
    throw new Error('No backup found on this device.');
  }
  await removeDirectoryRecursive(localDirectoryPath);
  await ReactNativeBlobUtil.fs.cp(source, localDirectoryPath);
}

/** Fast check for Settings UI — must not block on slow iCloud setup. */
export async function isCloudBackupAvailable(): Promise<boolean> {
  if (Platform.OS === 'ios') {
    if (!nativeModule?.isCloudAvailable) {
      return false;
    }
    return withTimeout(nativeModule.isCloudAvailable(), 3_000, false);
  }
  return androidIsCloudAvailable();
}

/** Quick metadata read for Settings badges and install checks. */
export async function getCloudBackupMetadata(): Promise<CloudBackupMetadata | null> {
  if (Platform.OS === 'ios') {
    if (!nativeModule?.getCloudBackupMetadata) {
      return null;
    }
    try {
      return await withTimeout(
        nativeModule.getCloudBackupMetadata(),
        8_000,
        null,
      );
    } catch {
      return null;
    }
  }
  return androidGetCloudBackupMetadata();
}

/** Slower metadata read before backup/restore decisions. */
export async function getCloudBackupMetadataForOperation(): Promise<CloudBackupMetadata | null> {
  if (Platform.OS === 'ios') {
    if (!nativeModule?.getCloudBackupMetadata) {
      return null;
    }
    try {
      return await withTimeout(
        nativeModule.getCloudBackupMetadata(),
        30_000,
        null,
      );
    } catch {
      return null;
    }
  }
  return androidGetCloudBackupMetadata();
}

export async function uploadBackupDirectory(
  localDirectoryPath: string,
): Promise<void> {
  const upload = async () => {
    if (Platform.OS === 'ios') {
      if (!nativeModule?.uploadBackupDirectory) {
        throw new Error('iCloud backup is not available on this build.');
      }
      await nativeModule.uploadBackupDirectory(localDirectoryPath);
      return;
    }
    await androidUploadBackupDirectory(localDirectoryPath);
  };

  await withTimeoutReject(
    upload(),
    BACKUP_UPLOAD_TIMEOUT_MS,
    `Backup timed out while uploading to ${getCloudProviderLabel()}. Try again on Wi‑Fi.`,
  );
}

export async function downloadBackupDirectory(
  localDirectoryPath: string,
): Promise<void> {
  if (Platform.OS === 'ios') {
    if (!nativeModule?.downloadBackupDirectory) {
      throw new Error('iCloud backup is not available on this build.');
    }
    await nativeModule.downloadBackupDirectory(localDirectoryPath);
    return;
  }
  await androidDownloadBackupDirectory(localDirectoryPath);
}

export function getBackupStagingDirectory(): string {
  return `${ReactNativeBlobUtil.fs.dirs.CacheDir}/lifemap-backup-staging`;
}

export async function removeBackupStagingDirectory(): Promise<void> {
  await removeDirectoryRecursive(getBackupStagingDirectory());
}

export function getCloudProviderLabel(): string {
  return Platform.OS === 'ios' ? 'iCloud' : 'Device storage';
}

export function getCloudBackupButtonLabel(): string {
  return Platform.OS === 'ios'
    ? 'Backup to iCloud'
    : 'Backup to device storage';
}

export function getCloudRestoreButtonLabel(): string {
  return Platform.OS === 'ios'
    ? 'Restore from iCloud'
    : 'Restore from device storage';
}
