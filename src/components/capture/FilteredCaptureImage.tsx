import {ColorMatrix} from 'react-native-color-matrix-image-filters';
import {Image, type ImageResizeMode, type ImageStyle, type StyleProp} from 'react-native';

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
  const matrix = getPhotoFilterMatrix(filterId);
  const imageStyle = [
    width != null && height != null ? {width, height} : null,
    style,
  ];

  const image = (
    <Image
      source={{uri}}
      style={imageStyle}
      resizeMode={resizeMode}
    />
  );

  if (matrix == null) {
    return image;
  }

  return (
    <ColorMatrix
      matrix={matrix}
      style={width != null && height != null ? {width, height} : style}>
      {image}
    </ColorMatrix>
  );
}
