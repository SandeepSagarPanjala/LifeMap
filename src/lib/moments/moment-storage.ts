import ReactNativeBlobUtil from 'react-native-blob-util';

import {
  getDocumentDirectory,
  normalizeMomentContentPath,
  resolveMomentContentPath,
} from '@/lib/moments/moment-media-uri';

export const MOMENTS_DIRECTORY = 'moments';
export const MOMENTS_TMP_DIRECTORY = '.tmp';
/** File extension for compressed photo/note attachments (not MIME label). */
export const MOMENT_IMAGE_FILE_EXTENSION = 'jpg';

export function createMomentFileId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

export { getDocumentDirectory } from '@/lib/moments/moment-media-uri';

export function momentsRootDirectory(documentDir: string): string {
  return `${documentDir}/${MOMENTS_DIRECTORY}`;
}

export function momentSandboxPath(
  documentDir: string,
  id: string,
  extension: string,
): string {
  return `${momentsRootDirectory(documentDir)}/${id}.${extension}`;
}

/** Persist only the `moments/...` suffix in SQLite — survives iOS path prefix changes. */
export function toStoredMomentContentPath(absolutePath: string): string {
  const docs = getDocumentDirectory();
  const normalized = normalizeMomentContentPath(absolutePath);
  if (normalized.startsWith(`${docs}/`)) {
    return normalized.slice(docs.length + 1);
  }
  return normalized;
}

export function momentsTempDirectory(documentDir: string): string {
  return `${momentsRootDirectory(documentDir)}/${MOMENTS_TMP_DIRECTORY}`;
}

export async function ensureMomentsDirectory(): Promise<string> {
  const root = momentsRootDirectory(getDocumentDirectory());
  const exists = await ReactNativeBlobUtil.fs.exists(root);
  if (!exists) {
    await ReactNativeBlobUtil.fs.mkdir(root);
  }
  return root;
}

export async function ensureMomentsTempDirectory(): Promise<string> {
  const root = await ensureMomentsDirectory();
  const tmp = `${root}/${MOMENTS_TMP_DIRECTORY}`;
  const exists = await ReactNativeBlobUtil.fs.exists(tmp);
  if (!exists) {
    await ReactNativeBlobUtil.fs.mkdir(tmp);
  }
  return tmp;
}

export async function createTempVoiceRecordingPath(): Promise<string> {
  const tmp = await ensureMomentsTempDirectory();
  return `${tmp}/${createMomentFileId()}.m4a`;
}

async function resolveExistingSourcePath(sourceUri: string): Promise<string> {
  const sourcePath = resolveMomentContentPath(sourceUri);
  const exists = await ReactNativeBlobUtil.fs.exists(sourcePath);
  if (!exists) {
    throw new Error(`Moment source file is missing: ${sourcePath}`);
  }
  return sourcePath;
}

async function verifyPersistedFile(contentPath: string): Promise<number> {
  const exists = await ReactNativeBlobUtil.fs.exists(contentPath);
  if (!exists) {
    throw new Error(`Moment file was not saved: ${contentPath}`);
  }
  const stat = await ReactNativeBlobUtil.fs.stat(contentPath);
  if (!stat.size || stat.size <= 0) {
    await ReactNativeBlobUtil.fs.unlink(contentPath).catch(() => undefined);
    throw new Error(`Moment file is empty: ${contentPath}`);
  }
  return stat.size;
}

async function writeSourceToSandbox(
  sourcePath: string,
  contentPath: string,
): Promise<void> {
  try {
    await ReactNativeBlobUtil.fs.cp(sourcePath, contentPath);
  } catch {
    await ReactNativeBlobUtil.fs.mv(sourcePath, contentPath);
  }
  await verifyPersistedFile(contentPath);
}

export async function persistFileToMomentSandbox(
  sourceUri: string,
  extension: string,
): Promise<{ contentPath: string; contentBytes: number }> {
  await ensureMomentsDirectory();
  const sourcePath = await resolveExistingSourcePath(sourceUri);
  const absolutePath = momentSandboxPath(
    getDocumentDirectory(),
    createMomentFileId(),
    extension,
  );

  await writeSourceToSandbox(sourcePath, absolutePath);
  const contentBytes = await verifyPersistedFile(absolutePath);
  return {
    contentPath: toStoredMomentContentPath(absolutePath),
    contentBytes,
  };
}

/** Move a temp recording into the permanent moments sandbox. */
export async function moveFileToMomentSandbox(
  sourceUri: string,
  extension: string,
): Promise<{ contentPath: string; contentBytes: number }> {
  await ensureMomentsDirectory();
  const sourcePath = await resolveExistingSourcePath(sourceUri);
  const absolutePath = momentSandboxPath(
    getDocumentDirectory(),
    createMomentFileId(),
    extension,
  );

  try {
    await ReactNativeBlobUtil.fs.mv(sourcePath, absolutePath);
    const contentBytes = await verifyPersistedFile(absolutePath);
    return {
      contentPath: toStoredMomentContentPath(absolutePath),
      contentBytes,
    };
  } catch {
    await writeSourceToSandbox(sourcePath, absolutePath);
    const contentBytes = await verifyPersistedFile(absolutePath);
    return {
      contentPath: toStoredMomentContentPath(absolutePath),
      contentBytes,
    };
  }
}

/** @deprecated Use persistFileToMomentSandbox */
export async function copyFileToMomentSandbox(
  sourceUri: string,
  extension: string,
): Promise<{ contentPath: string; contentBytes: number }> {
  return persistFileToMomentSandbox(sourceUri, extension);
}

export async function getFileSizeBytes(path: string): Promise<number> {
  const stat = await ReactNativeBlobUtil.fs.stat(
    resolveMomentContentPath(path),
  );
  return stat.size;
}

export async function deleteMomentContentFile(
  contentPath: string | null | undefined,
): Promise<void> {
  if (!contentPath) {
    return;
  }
  const path = resolveMomentContentPath(contentPath);
  const exists = await ReactNativeBlobUtil.fs.exists(path);
  if (exists) {
    await ReactNativeBlobUtil.fs.unlink(path);
  }
}
