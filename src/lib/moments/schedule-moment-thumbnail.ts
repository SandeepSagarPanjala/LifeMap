import {
  updateMomentThumbnailPath,
  type MomentRow,
} from '@/db/repositories/moments';
import {
  generatePhotoThumbnail,
  generateVideoThumbnail,
} from '@/lib/moments/generate-moment-thumbnail';

/**
 * Generate and persist a gallery thumbnail after capture.
 * Fire-and-forget — never blocks the capture UX.
 */
export function scheduleMomentThumbnailGeneration(moment: MomentRow): void {
  if (
    (moment.type !== 'photo' && moment.type !== 'video') ||
    !moment.contentPath ||
    moment.thumbnailPath
  ) {
    return;
  }

  void (async () => {
    try {
      const thumbnailPath =
        moment.type === 'photo'
          ? await generatePhotoThumbnail(moment.contentPath!)
          : await generateVideoThumbnail(moment.contentPath!);
      await updateMomentThumbnailPath(moment.id, thumbnailPath);
    } catch (error) {
      if (__DEV__) {
        console.warn('[moments] thumbnail generation failed', moment.id, error);
      }
    }
  })();
}
