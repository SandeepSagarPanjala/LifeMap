import { compressMomentImage } from '@/lib/moments/compress-image';
import {
  MOMENT_IMAGE_FILE_EXTENSION,
  persistFileToMomentSandbox,
} from '@/lib/moments/moment-storage';

/** Compress then copy into the moments sandbox; return stored relative path. */
export async function persistActivityImage(
  sourceUri: string,
): Promise<string> {
  // Compression materializes content:// (and similar) into a real file path,
  // matching note-photo persistence and keeping receipts smaller.
  const compressedUri = await compressMomentImage(sourceUri);
  const { contentPath } = await persistFileToMomentSandbox(
    compressedUri,
    MOMENT_IMAGE_FILE_EXTENSION,
  );
  return contentPath;
}
