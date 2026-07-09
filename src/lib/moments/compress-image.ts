import { Image } from 'react-native-compressor';

import { DEFAULT_IMAGE_COMPRESS_OPTIONS } from '@/lib/moments/media-compress-config';

export async function compressMomentImage(inputUri: string): Promise<string> {
  const { maxDimension, quality } = DEFAULT_IMAGE_COMPRESS_OPTIONS;
  return Image.compress(inputUri, {
    compressionMethod: 'manual',
    maxWidth: maxDimension,
    maxHeight: maxDimension,
    quality,
  });
}
