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

const ANDROID_BACKUP_DIR = 'LifeMapBackups/current';

function getAndroidBackupDirectory(): string {
  return `${ReactNativeBlobUtil.fs.dirs.DocumentDir}/${ANDROID_BACKUP_DIR}`;
}

async function androidIsCloudAvailable(): Promise<boolean> {
  return true;
}

async function androidGetCloudBackupMetadata(): Promise<CloudBackupMetadata | null> {
  const manifestPath = `${getAndroidBackupDirectory()}/manifest.json`;
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

async function androidUploadBackupDirectory(
  localDirectoryPath: string,
): Promise<void> {
  const destination = getAndroidBackupDirectory();
  await removeDirectoryRecursive(destination);
  await ReactNativeBlobUtil.fs.cp(localDirectoryPath, destination);
}

async function androidDownloadBackupDirectory(
  localDirectoryPath: string,
): Promise<void> {
  const source = getAndroidBackupDirectory();
  if (!(await ReactNativeBlobUtil.fs.exists(source))) {
    throw new Error('No backup found on this device.');
  }
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
