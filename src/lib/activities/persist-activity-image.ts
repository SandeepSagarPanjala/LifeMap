import {
  createMomentFileId,
  ensureMomentsDirectory,
  MOMENT_IMAGE_FILE_EXTENSION,
  toStoredMomentContentPath,
} from '@/lib/moments/moment-storage';
import { getDocumentDirectory } from '@/lib/moments/moment-media-uri';
import ReactNativeBlobUtil from 'react-native-blob-util';

/** Copy a picker/camera image into the moments sandbox; return stored relative path. */
export async function persistActivityImage(
  sourceUri: string,
): Promise<string> {
  await ensureMomentsDirectory();
  const docs = getDocumentDirectory();
  const destAbs = `${docs}/moments/${createMomentFileId()}.${MOMENT_IMAGE_FILE_EXTENSION}`;
  let sourcePath = sourceUri;
  if (sourcePath.startsWith('file://')) {
    sourcePath = sourcePath.slice('file://'.length);
    try {
      sourcePath = decodeURIComponent(sourcePath);
    } catch {
      // keep path
    }
  }
  await ReactNativeBlobUtil.fs.cp(sourcePath, destAbs);
  return toStoredMomentContentPath(destAbs);
}
