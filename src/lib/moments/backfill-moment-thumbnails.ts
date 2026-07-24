import {
  clearAllMomentThumbnails,
  countMomentsMissingThumbnails,
  listMomentsMissingThumbnails,
  updateMomentThumbnailPath,
} from '@/db/repositories/moments';
import {
  generatePhotoThumbnail,
  generateVideoThumbnail,
} from '@/lib/moments/generate-moment-thumbnail';

export type ThumbnailBackfillProgress = {
  done: number;
  total: number;
  failed: number;
};

const BATCH_SIZE = 20;

/**
 * Regenerate gallery thumbnails for all photo/video moments.
 * Clears existing thumbs first so quality bumps apply, then fills missing.
 * Call from Dev Tools only — new captures generate thumbs at save time.
 */
export async function backfillMomentThumbnails(
  onProgress?: (progress: ThumbnailBackfillProgress) => void,
): Promise<ThumbnailBackfillProgress> {
  await clearAllMomentThumbnails();

  const total = await countMomentsMissingThumbnails();
  let done = 0;
  let failed = 0;
  onProgress?.({ done, total, failed });

  while (done + failed < total) {
    const batch = await listMomentsMissingThumbnails(BATCH_SIZE);
    if (batch.length === 0) {
      break;
    }

    for (const moment of batch) {
      try {
        if (!moment.contentPath) {
          failed += 1;
          continue;
        }
        const thumbnailPath =
          moment.type === 'photo'
            ? await generatePhotoThumbnail(moment.contentPath)
            : await generateVideoThumbnail(moment.contentPath);
        await updateMomentThumbnailPath(moment.id, thumbnailPath);
        done += 1;
      } catch {
        failed += 1;
      }
      onProgress?.({ done, total, failed });
    }
  }

  return { done, total, failed };
}
