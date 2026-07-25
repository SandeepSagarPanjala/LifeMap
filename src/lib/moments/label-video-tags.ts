import {
  clearCache,
  createVideoThumbnail,
} from 'react-native-compressor';
import ReactNativeBlobUtil from 'react-native-blob-util';

import { labelPhotoTags } from '@/lib/moments/image-label-native';
import {
  MAX_PHOTO_TAGS,
  sanitizePhotoTagCandidates,
  type PhotoTagCandidate,
} from '@/lib/moments/moment-tags';
import { videoTagSampleTimesMs } from '@/lib/moments/video-tag-samples';

function toFileUri(path: string): string {
  if (path.startsWith('file://')) {
    return path;
  }
  return `file://${path}`;
}

async function deleteTempFrame(path: string): Promise<void> {
  let absolute = path;
  if (path.startsWith('file://')) {
    const withoutScheme = path.slice('file://'.length);
    try {
      absolute = decodeURIComponent(withoutScheme);
    } catch {
      absolute = withoutScheme;
    }
  }
  try {
    const exists = await ReactNativeBlobUtil.fs.exists(absolute);
    if (exists) {
      await ReactNativeBlobUtil.fs.unlink(absolute);
    }
  } catch {
    // Best-effort cleanup; thumbnail cache is also cleared below.
  }
}

/**
 * Label a video by sampling three frames (1s / midpoint / duration−2s),
 * running on-device image labeling on each, then keeping the top 8 tags.
 */
export async function labelVideoTags(
  videoUri: string,
  durationMs: number,
  options?: { maxTags?: number },
): Promise<PhotoTagCandidate[]> {
  if (!videoUri.trim() || !Number.isFinite(durationMs) || durationMs <= 0) {
    return [];
  }

  const maxTags = options?.maxTags ?? MAX_PHOTO_TAGS;
  const sampleTimes = videoTagSampleTimesMs(durationMs);
  const merged: PhotoTagCandidate[] = [];
  const tempPaths: string[] = [];

  try {
    for (const timeMs of sampleTimes) {
      try {
        const frame = await createVideoThumbnail(videoUri, { timeMs });
        const frameUri = toFileUri(frame.path);
        tempPaths.push(frame.path);
        const tags = await labelPhotoTags(frameUri, { maxTags: maxTags * 2 });
        merged.push(...tags);
      } catch {
        // Skip a failed frame and keep labeling the rest.
      }
    }
  } finally {
    await Promise.all(tempPaths.map(path => deleteTempFrame(path)));
    try {
      await clearCache();
    } catch {
      // Ignore cache cleanup failures.
    }
  }

  return sanitizePhotoTagCandidates(merged, maxTags);
}
