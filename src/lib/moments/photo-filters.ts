import type {ElementRef, RefObject} from 'react';
import {
  concatColorMatrices,
  contrast,
  cool,
  grayscale,
  saturate,
  warm,
  type Matrix,
} from 'react-native-color-matrix-image-filters';
import {captureRef} from 'react-native-view-shot';
import type {default as ViewShotComponent} from 'react-native-view-shot';

export type PhotoFilterId = 'original' | 'bw' | 'warm' | 'cool' | 'vivid';

export type PhotoFilterOption = {
  id: PhotoFilterId;
  label: string;
};

export const PHOTO_FILTER_OPTIONS: PhotoFilterOption[] = [
  {id: 'original', label: 'Original'},
  {id: 'bw', label: 'B&W'},
  {id: 'warm', label: 'Warm'},
  {id: 'cool', label: 'Cool'},
  {id: 'vivid', label: 'Vivid'},
];

export function getPhotoFilterMatrix(filterId: PhotoFilterId): Matrix | null {
  switch (filterId) {
    case 'original':
      return null;
    case 'bw':
      return concatColorMatrices(grayscale(1), contrast(1.25));
    case 'warm':
      return concatColorMatrices(warm(), saturate(1.08));
    case 'cool':
      return cool();
    case 'vivid':
      return concatColorMatrices(saturate(1.4), contrast(1.15));
    default:
      return null;
  }
}

export async function captureFilteredPhotoUri(
  viewShotRef: RefObject<ElementRef<typeof ViewShotComponent> | null>,
  filterId: PhotoFilterId,
  sourceUri: string,
  forceCapture = false,
): Promise<string> {
  if (filterId === 'original' && !forceCapture) {
    return sourceUri;
  }
  if (viewShotRef.current == null) {
    throw new Error('Filtered photo capture view is not ready.');
  }

  await new Promise<void>(resolve => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => resolve());
    });
  });

  return captureRef(viewShotRef, {
    format: 'jpg',
    quality: 1,
    result: 'tmpfile',
    useRenderInContext: true,
  });
}
