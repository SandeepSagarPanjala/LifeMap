import {Video} from 'react-native-compressor';

import {DEFAULT_VIDEO_COMPRESS_OPTIONS} from '@/lib/moments/media-compress-config';

export async function compressMomentVideo(
  inputUri: string,
  onProgress?: (progress: number) => void,
): Promise<string> {
  const {compressionMethod, maxSize} = DEFAULT_VIDEO_COMPRESS_OPTIONS;
  return Video.compress(
    inputUri,
    {
      compressionMethod,
      maxSize,
    },
    onProgress,
  );
}
