import { NativeModules } from 'react-native';

import {
  MAX_PHOTO_TAGS,
  sanitizePhotoTagCandidates,
  type PhotoTagCandidate,
} from '@/lib/moments/moment-tags';

export type ImageLabelResult = {
  label: string;
  confidence: number;
};

type ImageLabelNativeModule = {
  labelImage(
    uri: string,
    maxResults: number,
    minConfidence: number,
  ): Promise<ImageLabelResult[]>;
};

const nativeModule = NativeModules.ImageLabelModule as
  | ImageLabelNativeModule
  | undefined;

/** No floor — we keep the top N by confidence instead. */
const DEFAULT_MIN_CONFIDENCE = 0;

function toFilePath(uri: string): string {
  if (!uri.startsWith('file://')) {
    return uri;
  }
  const withoutScheme = uri.slice('file://'.length);
  try {
    return decodeURIComponent(withoutScheme);
  } catch {
    return withoutScheme;
  }
}

/**
 * On-device scene labels for a photo URI. Returns the top tags by confidence
 * (no minimum threshold). Empty when native labeling is unavailable.
 */
export async function labelPhotoTags(
  imageUri: string,
  options?: { maxTags?: number },
): Promise<PhotoTagCandidate[]> {
  if (!nativeModule?.labelImage || !imageUri.trim()) {
    return [];
  }

  const maxTags = options?.maxTags ?? MAX_PHOTO_TAGS;

  try {
    // Ask native for extra candidates, then keep the top `maxTags`.
    const results = await nativeModule.labelImage(
      toFilePath(imageUri),
      Math.max(maxTags * 4, 24),
      DEFAULT_MIN_CONFIDENCE,
    );
    if (!Array.isArray(results)) {
      return [];
    }
    const ranked = [...results].filter(
      item =>
        item &&
        typeof item.label === 'string' &&
        typeof item.confidence === 'number' &&
        Number.isFinite(item.confidence),
    );
    return sanitizePhotoTagCandidates(ranked, maxTags);
  } catch {
    return [];
  }
}
