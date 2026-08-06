import { Alert } from 'react-native';
import { APP_COPY } from '@/lib/app-copy';

import { insertMoment, type MomentRow } from '@/db/repositories/moments';
import { saveMomentToGallery } from '@/lib/moments/capture-photo';
import { compressMomentVideo } from '@/lib/moments/compress-video';
import {
  MIN_VIDEO_DURATION_MS,
  PHOTO_CAPTION_MAX_LENGTH,
  VIDEO_CONTENT_FORMAT,
  VIDEO_MAX_DURATION_MS,
} from '@/lib/app-constants';
import { persistFileToMomentSandbox } from '@/lib/moments/moment-storage';
import { serializeMomentTagsJson } from '@/lib/moments/moment-tags';
import { scheduleMomentThumbnailGeneration } from '@/lib/moments/schedule-moment-thumbnail';

const MOMENT_VIDEO_FILE_EXTENSION = 'mp4';

export type SaveVideoMomentProgress = {
  label: string;
  progress?: number;
};

export function isVideoRecordingTooShort(durationMs: number): boolean {
  return durationMs < MIN_VIDEO_DURATION_MS;
}

export function isVideoRecordingTooLong(durationMs: number): boolean {
  return durationMs > VIDEO_MAX_DURATION_MS;
}

function clipCaption(caption: string | null | undefined): string | null {
  const trimmed = caption?.trim() || null;
  if (trimmed == null) {
    return null;
  }
  return trimmed.length > PHOTO_CAPTION_MAX_LENGTH
    ? trimmed.slice(0, PHOTO_CAPTION_MAX_LENGTH)
    : trimmed;
}

export async function saveVideoMoment(
  sourceUri: string,
  durationMs: number,
  caption?: string | null,
  onProgress?: (update: SaveVideoMomentProgress) => void,
  tags?: readonly string[] | null,
  mood?: { moodLabel: string; moodVariant: string } | null,
): Promise<MomentRow> {
  if (isVideoRecordingTooShort(durationMs)) {
    throw new Error('Video is too short to save.');
  }
  if (isVideoRecordingTooLong(durationMs)) {
    throw new Error('Video is too long to save.');
  }

  onProgress?.({ label: 'Saving to Photos…' });
  try {
    await saveMomentToGallery(sourceUri, 'video');
  } catch {
    Alert.alert(
      APP_COPY.capture.videoSaved,
      APP_COPY.capture.photoSavedPhotosFailed,
    );
  }

  let compressedUri: string;
  try {
    compressedUri = await compressMomentVideo(sourceUri, progress => {
      onProgress?.({
        label: 'Compressing video…',
        progress: Math.max(0, Math.min(1, progress)),
      });
    });
  } catch {
    throw new Error('Failed to compress the video for LifeMap.');
  }

  onProgress?.({ label: 'Finishing up…' });
  const sandboxFile = await persistFileToMomentSandbox(
    compressedUri,
    MOMENT_VIDEO_FILE_EXTENSION,
  );

  const moodLabel = mood?.moodLabel.trim() || null;
  const moodVariant = mood?.moodVariant.trim() || null;

  try {
    const row = await insertMoment({
      type: 'video',
      timestamp: new Date(),
      contentPath: sandboxFile.contentPath,
      contentBytes: sandboxFile.contentBytes,
      contentFormat: VIDEO_CONTENT_FORMAT,
      caption: clipCaption(caption),
      tagsJson: serializeMomentTagsJson(tags),
      moodLabel,
      moodVariant,
    });
    scheduleMomentThumbnailGeneration(row);
    return row;
  } catch (error) {
    const { deleteMomentContentFile } = await import(
      '@/lib/moments/moment-storage'
    );
    await deleteMomentContentFile(sandboxFile.contentPath).catch(
      () => undefined,
    );
    throw error;
  }
}
