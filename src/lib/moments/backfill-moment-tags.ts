import { getVideoMetaData } from 'react-native-compressor';

import {
  countMomentsMissingTags,
  listMomentsMissingTags,
  updateMomentTagsJson,
  type MomentRow,
} from '@/db/repositories/moments';
import { labelPhotoTags } from '@/lib/moments/image-label-native';
import { labelVideoTags } from '@/lib/moments/label-video-tags';
import {
  momentImageUri,
  momentVideoUri,
  resolveExistingMomentContentPath,
} from '@/lib/moments/moment-media-uri';
import { serializeMomentTagsJson } from '@/lib/moments/moment-tags';

export type MomentTagBackfillProgress = {
  done: number;
  total: number;
  failed: number;
  skipped: number;
};

/** @deprecated Prefer MomentTagBackfillProgress. */
export type PhotoTagBackfillProgress = MomentTagBackfillProgress;

const BATCH_SIZE = 10;

async function resolveVideoDurationMs(
  videoUri: string,
): Promise<number | null> {
  try {
    const meta = await getVideoMetaData(videoUri);
    const durationSec = meta?.duration;
    if (
      typeof durationSec !== 'number' ||
      !Number.isFinite(durationSec) ||
      durationSec <= 0
    ) {
      return null;
    }
    return Math.round(durationSec * 1000);
  } catch {
    return null;
  }
}

async function labelMomentTags(
  moment: MomentRow,
  existingPath: string,
): Promise<string[]> {
  if (moment.type === 'video') {
    const videoUri = momentVideoUri(existingPath);
    const durationMs = await resolveVideoDurationMs(videoUri);
    if (durationMs == null) {
      return [];
    }
    const tags = await labelVideoTags(videoUri, durationMs);
    return tags.map(tag => tag.label);
  }

  const tags = await labelPhotoTags(momentImageUri(existingPath));
  return tags.map(tag => tag.label);
}

/**
 * Label photo/video moments that have no tags yet (on-device Vision / ML Kit).
 * Videos sample three frames. Dev Tools only — new captures tag at review time.
 */
export async function backfillMomentTags(
  onProgress?: (progress: MomentTagBackfillProgress) => void,
): Promise<MomentTagBackfillProgress> {
  const total = await countMomentsMissingTags();
  let done = 0;
  let failed = 0;
  let skipped = 0;
  let afterId = 0;
  onProgress?.({ done, total, failed, skipped });

  while (done + failed + skipped < total) {
    const batch = await listMomentsMissingTags(BATCH_SIZE, afterId);
    if (batch.length === 0) {
      break;
    }

    for (const moment of batch) {
      afterId = moment.id;
      try {
        if (!moment.contentPath) {
          skipped += 1;
          onProgress?.({ done, total, failed, skipped });
          continue;
        }
        const existingPath = await resolveExistingMomentContentPath(
          moment.contentPath,
        );
        if (!existingPath) {
          skipped += 1;
          onProgress?.({ done, total, failed, skipped });
          continue;
        }

        const tags = await labelMomentTags(moment, existingPath);
        if (tags.length === 0) {
          // Persist empty so we don't retry forever on unlabeled scenes.
          await updateMomentTagsJson(moment.id, '[]');
          skipped += 1;
          onProgress?.({ done, total, failed, skipped });
          continue;
        }

        await updateMomentTagsJson(
          moment.id,
          serializeMomentTagsJson(tags),
        );
        done += 1;
      } catch {
        failed += 1;
      }
      onProgress?.({ done, total, failed, skipped });
    }
  }

  return { done, total, failed, skipped };
}

/** @deprecated Prefer backfillMomentTags. */
export const backfillMomentPhotoTags = backfillMomentTags;
