import {Alert} from 'react-native';
import {
  launchCamera,
  launchImageLibrary,
  type CameraOptions,
  type ImageLibraryOptions,
  type ImagePickerResponse,
} from 'react-native-image-picker';

import {compressMomentImage} from '@/lib/moments/compress-image';
import {MAX_NOTE_PHOTO_ATTACHMENTS} from '@/lib/moments/note-photo-attachments';

const LIBRARY_OPTIONS: ImageLibraryOptions = {
  mediaType: 'photo',
  selectionLimit: MAX_NOTE_PHOTO_ATTACHMENTS,
  quality: 1,
};

const CAMERA_OPTIONS: CameraOptions = {
  mediaType: 'photo',
  cameraType: 'back',
  quality: 1,
  saveToPhotos: false,
};

export function getLibraryPickerErrorMessage(
  response: ImagePickerResponse,
): string | null {
  if (response.didCancel) {
    return null;
  }
  if (response.errorMessage) {
    return response.errorMessage;
  }
  if (response.errorCode === 'permission') {
    return 'Photo library access is required to attach photos to notes.';
  }
  return response.errorCode ? `Photo library error: ${response.errorCode}` : null;
}

export type PickedNotePhoto = {
  uri: string;
  sourceBytes: number | null;
};

export async function pickAndCompressNotePhotos(
  maxCount: number,
): Promise<PickedNotePhoto[]> {
  if (maxCount <= 0) {
    return [];
  }
  const response = await launchImageLibrary({
    ...LIBRARY_OPTIONS,
    selectionLimit: maxCount,
  });
  return pickNotePhotosFromResponse(response);
}

export async function pickAndCompressNotePhoto(): Promise<PickedNotePhoto | null> {
  const photos = await pickAndCompressNotePhotos(1);
  return photos[0] ?? null;
}

export async function captureAndCompressNotePhoto(): Promise<PickedNotePhoto | null> {
  return pickNotePhotoFromResponse(await launchCamera(CAMERA_OPTIONS));
}

async function pickNotePhotosFromResponse(
  response: ImagePickerResponse,
): Promise<PickedNotePhoto[]> {
  const errorMessage = getLibraryPickerErrorMessage(response);
  if (response.didCancel) {
    return [];
  }
  if (errorMessage) {
    Alert.alert('Could not open photo library', errorMessage);
    return [];
  }

  const assets = response.assets?.filter(asset => asset.uri) ?? [];
  if (assets.length === 0) {
    Alert.alert('Could not attach photo', 'No images were returned from the library.');
    return [];
  }

  const picked: PickedNotePhoto[] = [];
  for (const asset of assets) {
    if (!asset.uri) {
      continue;
    }
    try {
      const compressedUri = await compressMomentImage(asset.uri);
      picked.push({
        uri: compressedUri,
        sourceBytes: asset.fileSize ?? null,
      });
    } catch {
      Alert.alert('Could not attach photo', 'Failed to compress one of the selected photos.');
      break;
    }
  }
  return picked;
}

async function pickNotePhotoFromResponse(
  response: ImagePickerResponse,
): Promise<PickedNotePhoto | null> {
  const errorMessage = getLibraryPickerErrorMessage(response);
  if (response.didCancel) {
    return null;
  }
  if (errorMessage) {
    Alert.alert('Could not open photo library', errorMessage);
    return null;
  }

  const asset = response.assets?.[0];
  if (!asset?.uri) {
    Alert.alert('Could not attach photo', 'No image was returned from the library.');
    return null;
  }

  try {
    const compressedUri = await compressMomentImage(asset.uri);
    return {
      uri: compressedUri,
      sourceBytes: asset.fileSize ?? null,
    };
  } catch {
    Alert.alert('Could not attach photo', 'Failed to compress the photo for LifeMap.');
    return null;
  }
}
