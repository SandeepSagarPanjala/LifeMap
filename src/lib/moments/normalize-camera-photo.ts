import {Image} from 'react-native';
import {
  getImageMetaData,
  Image as CompressorImage,
} from 'react-native-compressor';

/** Bake EXIF orientation into pixels before preview/filter export. */
export const CAMERA_EDIT_MAX_DIMENSION = 4096;
export const CAMERA_EDIT_QUALITY = 1;

const ROTATED_EXIF_ORIENTATIONS = new Set([5, 6, 7, 8]);

function stripFileScheme(uri: string): string {
  return uri.replace(/^file:\/\//, '');
}

export function getOrientedDimensions(
  width: number,
  height: number,
  orientation: number,
): {width: number; height: number} {
  if (ROTATED_EXIF_ORIENTATIONS.has(orientation)) {
    return {width: height, height: width};
  }
  return {width, height};
}

export async function getImageDimensions(
  uri: string,
): Promise<{width: number; height: number}> {
  return new Promise((resolve, reject) => {
    Image.getSize(
      uri,
      (width, height) => resolve({width, height}),
      error => reject(error),
    );
  });
}

export async function normalizeCameraPhoto(sourceUri: string): Promise<{
  uri: string;
  width: number;
  height: number;
}> {
  const metadata = await getImageMetaData(stripFileScheme(sourceUri));
  const expectedDimensions = getOrientedDimensions(
    metadata.ImageWidth,
    metadata.ImageHeight,
    metadata.Orientation,
  );

  const normalizedUri = await CompressorImage.compress(sourceUri, {
    compressionMethod: 'auto',
    maxWidth: CAMERA_EDIT_MAX_DIMENSION,
    maxHeight: CAMERA_EDIT_MAX_DIMENSION,
    quality: CAMERA_EDIT_QUALITY,
  });

  const measured = await getImageDimensions(normalizedUri);
  const measuredIsLandscape =
    measured.width > measured.height && expectedDimensions.height > expectedDimensions.width;
  const measuredIsPortrait =
    measured.height > measured.width && expectedDimensions.width > expectedDimensions.height;

  if (measuredIsLandscape || measuredIsPortrait) {
    return {
      uri: normalizedUri,
      width: expectedDimensions.width,
      height: expectedDimensions.height,
    };
  }

  return {
    uri: normalizedUri,
    width: measured.width,
    height: measured.height,
  };
}
