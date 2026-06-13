import {
  getOrientedDimensions,
  normalizeCameraPhoto,
} from '../src/lib/moments/normalize-camera-photo';

jest.mock('react-native-compressor', () => ({
  getImageMetaData: jest.fn(async () => ({
    ImageWidth: 4032,
    ImageHeight: 3024,
    Orientation: 6,
    size: 1_000_000,
    extension: 'jpg',
    exif: {},
  })),
  Image: {
    compress: jest.fn(async (uri: string) => `normalized://${uri}`),
  },
}));

describe('getOrientedDimensions', () => {
  it('swaps dimensions for rotated EXIF orientations', () => {
    expect(getOrientedDimensions(4032, 3024, 6)).toEqual({
      width: 3024,
      height: 4032,
    });
  });

  it('keeps dimensions for upright EXIF orientations', () => {
    expect(getOrientedDimensions(3024, 4032, 1)).toEqual({
      width: 3024,
      height: 4032,
    });
  });
});

describe('normalizeCameraPhoto', () => {
  it('recompresses the capture and returns upright display dimensions', async () => {
    const {Image} = require('react-native');
    const getSizeSpy = jest
      .spyOn(Image, 'getSize')
      .mockImplementation(
        (
          _uri: string,
          success: (width: number, height: number) => void,
        ) => {
          success(4032, 3024);
        },
      );

    const result = await normalizeCameraPhoto('file:///tmp/photo.jpg');

    expect(result.uri).toBe('normalized://file:///tmp/photo.jpg');
    expect(result.width).toBe(3024);
    expect(result.height).toBe(4032);

    getSizeSpy.mockRestore();
  });
});
