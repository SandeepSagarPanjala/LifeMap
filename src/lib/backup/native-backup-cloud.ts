import {NativeModules, Platform} from 'react-native';
import ReactNativeBlobUtil from 'react-native-blob-util';

import type {CloudBackupMetadata} from './backup-types';
import {removeDirectoryRecursive} from './backup-fs';

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

function getAndroidBackupDirectory(slot: 'current' | 'previous'): string {
  return `${ReactNativeBlobUtil.fs.dirs.DocumentDir}/${ANDROID_BACKUP_ROOT}/${slot}`;
}

async function readAndroidManifest(
  slot: 'current' | 'previous',
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
  current: CloudBackupMetadata | null,
  previous: CloudBackupMetadata | null,
): CloudBackupMetadata | null {
  if (current == null) {
    return previous;
  }
  if (previous == null) {
    return current;
  }
  const currentTime = new Date(current.exportedAt).getTime();
  const previousTime = new Date(previous.exportedAt).getTime();
  if (
    Number.isFinite(currentTime) &&
    Number.isFinite(previousTime) &&
    currentTime !== previousTime
  ) {
    return currentTime >= previousTime ? current : previous;
  }
  return current.totalBytes >= previous.totalBytes ? current : previous;
}

async function pickAndroidBackupSlot(): Promise<'current' | 'previous' | null> {
  const [current, previous] = await Promise.all([
    readAndroidManifest('current'),
    readAndroidManifest('previous'),
  ]);
  const best = pickBestMetadata(current, previous);
  if (best == null) {
    return null;
  }
  return best === current ? 'current' : 'previous';
}

async function androidIsCloudAvailable(): Promise<boolean> {
  return true;
}

async function androidGetCloudBackupMetadata(): Promise<CloudBackupMetadata | null> {
  const [current, previous] = await Promise.all([
    readAndroidManifest('current'),
    readAndroidManifest('previous'),
  ]);
  return pickBestMetadata(current, previous);
}

async function androidUploadBackupDirectory(
  localDirectoryPath: string,
): Promise<void> {
  const current = getAndroidBackupDirectory('current');
  const previous = getAndroidBackupDirectory('previous');
  if (await ReactNativeBlobUtil.fs.exists(current)) {
    if (await ReactNativeBlobUtil.fs.exists(previous)) {
      await removeDirectoryRecursive(previous);
    }
    await ReactNativeBlobUtil.fs.mv(current, previous);
  }
  if (await ReactNativeBlobUtil.fs.exists(current)) {
    await removeDirectoryRecursive(current);
  }
  await ReactNativeBlobUtil.fs.cp(localDirectoryPath, current);
}

async function androidDownloadBackupDirectory(
  localDirectoryPath: string,
): Promise<void> {
  const slot = await pickAndroidBackupSlot();
  if (slot == null) {
    throw new Error('No backup found on this device.');
  }
  const source = getAndroidBackupDirectory(slot);
  await removeDirectoryRecursive(localDirectoryPath);
  await ReactNativeBlobUtil.fs.cp(source, localDirectoryPath);
}

export async function isCloudBackupAvailable(): Promise<boolean> {
  if (Platform.OS === 'ios') {
    if (!nativeModule?.isCloudAvailable) {
      return false;
    }
    return nativeModule.isCloudAvailable();
  }
  return androidIsCloudAvailable();
}

export async function getCloudBackupMetadata(): Promise<CloudBackupMetadata | null> {
  if (Platform.OS === 'ios') {
    if (!nativeModule?.getCloudBackupMetadata) {
      return null;
    }
    return nativeModule.getCloudBackupMetadata();
  }
  return androidGetCloudBackupMetadata();
}

export async function uploadBackupDirectory(
  localDirectoryPath: string,
): Promise<void> {
  if (Platform.OS === 'ios') {
    if (!nativeModule?.uploadBackupDirectory) {
      throw new Error('iCloud backup is not available on this build.');
    }
    await nativeModule.uploadBackupDirectory(localDirectoryPath);
    return;
  }
  await androidUploadBackupDirectory(localDirectoryPath);
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
  return Platform.OS === 'ios' ? 'iCloud' : 'device storage';
}
