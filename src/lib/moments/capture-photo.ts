import {CameraRoll} from '@react-native-camera-roll/camera-roll';
import {Alert, Platform} from 'react-native';
import {
  launchCamera,
  type CameraOptions,
  type ImagePickerResponse,
} from 'react-native-image-picker';

import {insertMoment, type MomentRow} from '@/db/repositories/moments';
import {compressMomentImage} from '@/lib/moments/compress-image';
import {IMAGE_COMPRESS_FORMAT} from '@/lib/moments/media-compress-config';
import {
  MOMENT_IMAGE_FILE_EXTENSION,
  persistFileToMomentSandbox,
} from '@/lib/moments/moment-storage';
import {normalizeCameraPhoto} from '@/lib/moments/normalize-camera-photo';

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

export function getCameraLaunchErrorMessage(response: ImagePickerResponse): string | null {
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
    await CameraRoll.saveAsset(sourceUri, {type});
    return;
  }
  await CameraRoll.save(sourceUri, {type});
}

export async function saveCaptureToPhotoLibrary(sourceUri: string): Promise<void> {
  await saveMomentToGallery(sourceUri, 'photo');
}

export async function launchCameraPhotoDraft(): Promise<CameraPhotoDraft | null> {
  const response = await launchCamera(CAMERA_OPTIONS);
  const errorMessage = getCameraLaunchErrorMessage(response);
  if (response.didCancel) {
    return null;
  }
  if (errorMessage) {
    Alert.alert('Could not open camera', errorMessage);
    return null;
  }

  const asset = response.assets?.[0];
  if (!asset?.uri) {
    Alert.alert('Could not save photo', 'No image was returned from the camera.');
    return null;
  }

  let normalized;
  try {
    normalized = await normalizeCameraPhoto(asset.uri);
  } catch {
    Alert.alert('Could not prepare photo', 'Failed to orient the photo for editing.');
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
): Promise<MomentRow> {
  try {
    await saveCaptureToPhotoLibrary(sourceUri);
  } catch {
    Alert.alert(
      'Photo saved in LifeMap',
      'Your moment was saved in the app, but we could not add a copy to Photos.',
    );
  }

  let compressedUri: string;
  try {
    compressedUri = await compressMomentImage(sourceUri);
  } catch {
    throw new Error('Failed to compress the photo for LifeMap.');
  }

  const sandboxFile = await persistFileToMomentSandbox(
    compressedUri,
    MOMENT_IMAGE_FILE_EXTENSION,
  );

  return insertMoment({
    type: 'photo',
    timestamp: new Date(),
    contentPath: sandboxFile.contentPath,
    contentBytes: sandboxFile.contentBytes,
    sourceBytes,
    contentFormat: IMAGE_COMPRESS_FORMAT,
    caption: caption?.trim() || null,
  });
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
    Alert.alert(
      'Could not save photo',
      error instanceof Error ? error.message : 'Something went wrong.',
    );
    return null;
  }
}
