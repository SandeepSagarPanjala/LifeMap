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

const CAMERA_OPTIONS: CameraOptions = {
  mediaType: 'photo',
  cameraType: 'back',
  quality: 1,
  saveToPhotos: true,
  presentationStyle: 'fullScreen',
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
export async function saveCaptureToPhotoLibrary(sourceUri: string): Promise<void> {
  if (Platform.OS === 'ios') {
    await CameraRoll.saveAsset(sourceUri, {type: 'photo'});
    return;
  }
  await CameraRoll.save(sourceUri, {type: 'photo'});
}

export async function capturePhotoFromCamera(): Promise<MomentRow | null> {
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

  try {
    if (!CAMERA_OPTIONS.saveToPhotos) {
      await saveCaptureToPhotoLibrary(asset.uri);
    }
  } catch {
    Alert.alert(
      'Photo saved in LifeMap',
      'Your moment was saved in the app, but we could not add a copy to Photos.',
    );
  }

  let compressedUri: string;
  try {
    compressedUri = await compressMomentImage(asset.uri);
  } catch {
    Alert.alert('Could not save photo', 'Failed to compress the photo for LifeMap.');
    return null;
  }

  let sandboxFile: {contentPath: string; contentBytes: number};
  try {
    sandboxFile = await persistFileToMomentSandbox(
      compressedUri,
      MOMENT_IMAGE_FILE_EXTENSION,
    );
  } catch (error) {
    Alert.alert(
      'Could not save photo',
      error instanceof Error ? error.message : 'Failed to store the photo on this device.',
    );
    return null;
  }

  return insertMoment({
    type: 'photo',
    timestamp: new Date(),
    contentPath: sandboxFile.contentPath,
    contentBytes: sandboxFile.contentBytes,
    sourceBytes: asset.fileSize ?? null,
    contentFormat: IMAGE_COMPRESS_FORMAT,
  });
}
