import { Alert } from 'react-native';
import { APP_COPY } from '@/lib/app-copy';

import { insertMoment, type MomentRow } from '@/db/repositories/moments';
import { saveMomentToGallery } from '@/lib/moments/capture-photo';
import { compressMomentVideo } from '@/lib/moments/compress-video';
import { VIDEO_CONTENT_FORMAT } from '@/lib/app-constants';
import { persistFileToMomentSandbox } from '@/lib/moments/moment-storage';

const MIN_VIDEO_DURATION_MS = 500;
const MOMENT_VIDEO_FILE_EXTENSION = 'mp4';

export type SaveVideoMomentProgress = {
  label: string;
  progress?: number;
};

export function isVideoRecordingTooShort(durationMs: number): boolean {
  return durationMs < MIN_VIDEO_DURATION_MS;
}

export async function saveVideoMoment(
  sourceUri: string,
  durationMs: number,
  caption?: string | null,
  onProgress?: (update: SaveVideoMomentProgress) => void,
): Promise<MomentRow> {
  if (isVideoRecordingTooShort(durationMs)) {
    throw new Error('Video is too short to save.');
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

  try {
    return await insertMoment({
      type: 'video',
      timestamp: new Date(),
      contentPath: sandboxFile.contentPath,
      contentBytes: sandboxFile.contentBytes,
      contentFormat: VIDEO_CONTENT_FORMAT,
      caption: caption?.trim() || null,
    });
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
