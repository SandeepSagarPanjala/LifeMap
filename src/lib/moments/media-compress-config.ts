export {
  IMAGE_COMPRESS_FORMAT,
  IMAGE_COMPRESS_MAX_DIMENSION,
  IMAGE_COMPRESS_QUALITY,
  VIDEO_COMPRESS_MAX_SIZE,
  VIDEO_CONTENT_FORMAT,
  VIDEO_MAX_DURATION_MS,
  VOICE_CONTENT_FORMAT,
  VOICE_MAX_DURATION_MS,
} from '@/lib/app-constants';

import {
  IMAGE_COMPRESS_FORMAT,
  IMAGE_COMPRESS_MAX_DIMENSION,
  IMAGE_COMPRESS_QUALITY,
  VIDEO_COMPRESS_MAX_SIZE,
} from '@/lib/app-constants';

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

export type VideoCompressOptions = {
  compressionMethod: 'auto' | 'manual';
  maxSize: number;
};

export const DEFAULT_VIDEO_COMPRESS_OPTIONS: VideoCompressOptions = {
  compressionMethod: 'auto',
  maxSize: VIDEO_COMPRESS_MAX_SIZE,
};
