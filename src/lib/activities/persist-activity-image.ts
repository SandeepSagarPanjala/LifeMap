import {
  MOMENT_IMAGE_FILE_EXTENSION,
  persistFileToMomentSandbox,
} from '@/lib/moments/moment-storage';

/** Copy a picker/camera image into the moments sandbox; return stored relative path. */
export async function persistActivityImage(
  sourceUri: string,
): Promise<string> {
  const { contentPath } = await persistFileToMomentSandbox(
    sourceUri,
    MOMENT_IMAGE_FILE_EXTENSION,
  );
  return contentPath;
}
