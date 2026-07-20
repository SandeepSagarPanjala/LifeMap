import { useMemo } from 'react';
import { ColorMatrix } from 'react-native-color-matrix-image-filters';
import {
  Image,
  type ImageResizeMode,
  type ImageStyle,
  type StyleProp,
} from 'react-native';

import {
  getPhotoFilterMatrix,
  type PhotoFilterId,
} from '@/lib/moments/photo-filters';

type FilteredCaptureImageProps = {
  uri: string;
  filterId: PhotoFilterId;
  width?: number;
  height?: number;
  style?: StyleProp<ImageStyle>;
  resizeMode?: ImageResizeMode;
};

export function FilteredCaptureImage({
  uri,
  filterId,
  width,
  height,
  style,
  resizeMode = 'contain',
}: FilteredCaptureImageProps) {
  // Matrix concatenation is non-trivial; recompute only when the filter changes
  // (this renders in the filter thumbnail strip, one per available filter).
  const matrix = useMemo(() => getPhotoFilterMatrix(filterId), [filterId]);
  const source = useMemo(() => ({ uri }), [uri]);
  const sizeStyle = useMemo(
    () => (width != null && height != null ? { width, height } : null),
    [width, height],
  );
  const imageStyle = useMemo(
    () => [sizeStyle, style],
    [sizeStyle, style],
  );

  const image = (
    <Image source={source} style={imageStyle} resizeMode={resizeMode} />
  );

  if (matrix == null) {
    return image;
  }

  return (
    <ColorMatrix matrix={matrix} style={sizeStyle ?? style}>
      {image}
    </ColorMatrix>
  );
}
