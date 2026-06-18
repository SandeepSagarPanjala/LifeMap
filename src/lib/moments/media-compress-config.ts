/** JPEG compression defaults — used when react-native-compressor ships in Phase 3. */
export const IMAGE_COMPRESS_MAX_DIMENSION = 2048;
export const IMAGE_COMPRESS_QUALITY = 0.78;
export const IMAGE_COMPRESS_FORMAT = 'jpeg' as const;

export type ImageCompressOptions = {
  maxDimension: number;
  quality: number;
  format: typeof IMAGE_COMPRESS_FORMAT;
};

export const DEFAULT_IMAGE_COMPRESS_OPTIONS: ImageCompressOptions = {
  maxDimension: IMAGE_COMPRESS_MAX_DIMENSION,
  quality: IMAGE_COMPRESS_QUALITY,
  format: IMAGE_COMPRESS_FORMAT,
};

/** Voice memo defaults for Phase 4. */
export const VOICE_MAX_DURATION_MS = 5 * 60_000;
export const VOICE_CONTENT_FORMAT = 'aac' as const;

/** Video moment defaults. */
export const VIDEO_MAX_DURATION_MS = 5 * 60_000;
export const VIDEO_CONTENT_FORMAT = 'mp4' as const;
export const VIDEO_COMPRESS_MAX_SIZE = 1280;

export type VideoCompressOptions = {
  compressionMethod: 'auto' | 'manual';
  maxSize: number;
};

export const DEFAULT_VIDEO_COMPRESS_OPTIONS: VideoCompressOptions = {
  compressionMethod: 'auto',
  maxSize: VIDEO_COMPRESS_MAX_SIZE,
};
