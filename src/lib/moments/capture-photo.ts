import { CameraRoll } from '@react-native-camera-roll/camera-roll';
import { APP_COPY, errorMessageOr } from '@/lib/app-copy';
import { Alert, Platform } from 'react-native';
import {
  launchCamera,
  type CameraOptions,
  type ImagePickerResponse,
} from 'react-native-image-picker';

import { insertMoment, type MomentRow } from '@/db/repositories/moments';
import { compressMomentImage } from '@/lib/moments/compress-image';
import { IMAGE_COMPRESS_FORMAT } from '@/lib/app-constants';
import {
  MOMENT_IMAGE_FILE_EXTENSION,
  deleteMomentContentFile,
  moveFileToMomentSandbox,
  persistFileToMomentSandbox,
} from '@/lib/moments/moment-storage';
import { normalizeCameraPhoto } from '@/lib/moments/normalize-camera-photo';

const CAMERA_OPTIONS: CameraOptions = {
  mediaType: 'photo',
  cameraType: 'back',
  quality: 1,
  saveToPhotos: false,
  presentationStyle: 'fullScreen',
};

export type CameraPhotoDraft = {
  sourceUri: string;
  sourceWidth: number;
  sourceHeight: number;
  sourceBytes: number | null;
};

export function getCameraLaunchErrorMessage(
  response: ImagePickerResponse,
): string | null {
  if (response.didCancel) {
    return null;
  }
  if (response.errorMessage) {
    return response.errorMessage;
  }
  if (response.errorCode === 'permission') {
    return 'Camera access is required to capture moments.';
  }
  if (response.errorCode === 'camera_unavailable') {
    return 'Camera is not available on this device.';
  }
  return response.errorCode ? `Camera error: ${response.errorCode}` : null;
}

/** Save full-res capture to Photos when the picker did not already. */
export async function saveMomentToGallery(
  sourceUri: string,
  type: 'photo' | 'video',
): Promise<void> {
  if (Platform.OS === 'ios') {
    await CameraRoll.saveAsset(sourceUri, { type });
    return;
  }
  await CameraRoll.save(sourceUri, { type });
}

export async function saveCaptureToPhotoLibrary(
  sourceUri: string,
): Promise<void> {
  await saveMomentToGallery(sourceUri, 'photo');
}

export async function launchCameraPhotoDraft(): Promise<CameraPhotoDraft | null> {
  const response = await launchCamera(CAMERA_OPTIONS);
  const errorMessage = getCameraLaunchErrorMessage(response);
  if (response.didCancel) {
    return null;
  }
  if (errorMessage) {
    Alert.alert(APP_COPY.alerts.couldNotOpenCamera, errorMessage);
    return null;
  }

  const asset = response.assets?.[0];
  if (!asset?.uri) {
    Alert.alert(
      APP_COPY.alerts.couldNotSavePhoto,
      APP_COPY.alerts.noImageFromCamera,
    );
    return null;
  }

  let normalized;
  try {
    normalized = await normalizeCameraPhoto(asset.uri);
  } catch {
    Alert.alert(
      APP_COPY.alerts.couldNotPreparePhoto,
      APP_COPY.alerts.failedOrientPhoto,
    );
    return null;
  }

  return {
    sourceUri: normalized.uri,
    sourceWidth: normalized.width,
    sourceHeight: normalized.height,
    sourceBytes: asset.fileSize ?? null,
  };
}

export async function savePhotoMoment(
  sourceUri: string,
  sourceBytes: number | null,
  caption?: string | null,
  voiceAttachment?: { uri: string; durationMs: number } | null,
): Promise<MomentRow> {
  try {
    await saveCaptureToPhotoLibrary(sourceUri);
  } catch {
    Alert.alert(
      APP_COPY.capture.photoSaved,
      APP_COPY.capture.photoSavedPhotosFailed,
    );
  }

  let compressedUri: string;
  try {
    compressedUri = await compressMomentImage(sourceUri);
  } catch {
    throw new Error(APP_COPY.alerts.failedCompressPhotoForLifeMap);
  }

  const sandboxFile = await persistFileToMomentSandbox(
    compressedUri,
    MOMENT_IMAGE_FILE_EXTENSION,
  );

  let voiceAttachmentPath: string | null = null;
  let voiceAttachmentBytes: number | null = null;
  let voiceDurationSec: number | null = null;

  if (voiceAttachment) {
    if (voiceAttachment.durationMs < 500) {
      throw new Error('Voice attachment is too short to save.');
    }
    try {
      const voiceFile = await moveFileToMomentSandbox(
        voiceAttachment.uri,
        'm4a',
      );
      voiceAttachmentPath = voiceFile.contentPath;
      voiceAttachmentBytes = voiceFile.contentBytes;
      voiceDurationSec = Math.round(voiceAttachment.durationMs / 1000);
    } finally {
      await deleteMomentContentFile(voiceAttachment.uri);
    }
  }

  try {
    return await insertMoment({
      type: 'photo',
      timestamp: new Date(),
      contentPath: sandboxFile.contentPath,
      contentBytes: sandboxFile.contentBytes,
      sourceBytes,
      contentFormat: IMAGE_COMPRESS_FORMAT,
      caption: caption?.trim() || null,
      voiceAttachmentPath,
      voiceAttachmentBytes,
      voiceDurationSec,
    });
  } catch (error) {
    await deleteMomentContentFile(sandboxFile.contentPath).catch(
      () => undefined,
    );
    throw error;
  }
}

/** @deprecated Use launchCameraPhotoDraft + savePhotoMoment */
export async function capturePhotoFromCamera(): Promise<MomentRow | null> {
  const draft = await launchCameraPhotoDraft();
  if (!draft) {
    return null;
  }
  try {
    return await savePhotoMoment(draft.sourceUri, draft.sourceBytes);
  } catch (error) {
    Alert.alert(APP_COPY.alerts.couldNotSavePhoto, errorMessageOr(error));
    return null;
  }
}
