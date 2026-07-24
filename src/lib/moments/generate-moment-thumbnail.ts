import {
  createVideoThumbnail,
  Image,
} from 'react-native-compressor';

import {
  MOMENT_THUMBNAIL_MAX_DIMENSION,
  MOMENT_THUMBNAIL_QUALITY,
} from '@/lib/app-constants';
import {
  createMomentFileId,
  ensureMomentsDirectory,
  getDocumentDirectory,
  MOMENT_IMAGE_FILE_EXTENSION,
  momentsRootDirectory,
  toStoredMomentContentPath,
} from '@/lib/moments/moment-storage';
import {
  momentImageUri,
  momentVideoUri,
  resolveExistingMomentContentPath,
  resolveMomentContentPath,
} from '@/lib/moments/moment-media-uri';
import ReactNativeBlobUtil from 'react-native-blob-util';

const THUMBS_DIRECTORY = 'thumbs';

async function ensureThumbsDirectory(): Promise<string> {
  await ensureMomentsDirectory();
  const root = `${momentsRootDirectory(getDocumentDirectory())}/${THUMBS_DIRECTORY}`;
  const exists = await ReactNativeBlobUtil.fs.exists(root);
  if (!exists) {
    await ReactNativeBlobUtil.fs.mkdir(root);
  }
  return root;
}

async function persistCompressedThumb(
  compressedUri: string,
): Promise<string> {
  const thumbsDir = await ensureThumbsDirectory();
  const absolutePath = `${thumbsDir}/${createMomentFileId()}.${MOMENT_IMAGE_FILE_EXTENSION}`;
  const sourcePath = resolveMomentContentPath(compressedUri);
  try {
    await ReactNativeBlobUtil.fs.cp(sourcePath, absolutePath);
  } catch {
    await ReactNativeBlobUtil.fs.mv(sourcePath, absolutePath);
  }
  const exists = await ReactNativeBlobUtil.fs.exists(absolutePath);
  if (!exists) {
    throw new Error(`Thumbnail was not saved: ${absolutePath}`);
  }
  return toStoredMomentContentPath(absolutePath);
}

async function compressToThumbUri(sourceUri: string): Promise<string> {
  return Image.compress(sourceUri, {
    compressionMethod: 'manual',
    maxWidth: MOMENT_THUMBNAIL_MAX_DIMENSION,
    maxHeight: MOMENT_THUMBNAIL_MAX_DIMENSION,
    quality: MOMENT_THUMBNAIL_QUALITY,
  });
}

/** Build a ~200px JPEG thumb from a photo moment's content path. */
export async function generatePhotoThumbnail(
  contentPath: string,
): Promise<string> {
  const existing = await resolveExistingMomentContentPath(contentPath);
  if (!existing) {
    throw new Error(`Photo missing for thumbnail: ${contentPath}`);
  }
  const compressedUri = await compressToThumbUri(momentImageUri(existing));
  return persistCompressedThumb(compressedUri);
}

/** First-frame video thumb, then compress to gallery size. */
export async function generateVideoThumbnail(
  contentPath: string,
): Promise<string> {
  const existing = await resolveExistingMomentContentPath(contentPath);
  if (!existing) {
    throw new Error(`Video missing for thumbnail: ${contentPath}`);
  }
  const frame = await createVideoThumbnail(momentVideoUri(existing), {
    quality: MOMENT_THUMBNAIL_QUALITY,
  });
  const compressedUri = await compressToThumbUri(
    frame.path.startsWith('file://') ? frame.path : `file://${frame.path}`,
  );
  return persistCompressedThumb(compressedUri);
}
