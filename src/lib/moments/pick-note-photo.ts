import {Alert} from 'react-native';
import {
  launchImageLibrary,
  type ImageLibraryOptions,
  type ImagePickerResponse,
} from 'react-native-image-picker';

import {compressMomentImage} from '@/lib/moments/compress-image';

const LIBRARY_OPTIONS: ImageLibraryOptions = {
  mediaType: 'photo',
  selectionLimit: 1,
  quality: 1,
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

export async function pickAndCompressNotePhoto(): Promise<PickedNotePhoto | null> {
  const response = await launchImageLibrary(LIBRARY_OPTIONS);
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
