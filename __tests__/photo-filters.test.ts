import {
  getPhotoFilterMatrix,
  PHOTO_FILTER_OPTIONS,
} from '../src/lib/moments/photo-filters';

describe('photo filters', () => {
  it('exposes the v1 filter presets', () => {
    expect(PHOTO_FILTER_OPTIONS.map(option => option.id)).toEqual([
      'original',
      'bw',
      'warm',
      'cool',
      'vivid',
    ]);
  });

  it('returns no matrix for original', () => {
    expect(getPhotoFilterMatrix('original')).toBeNull();
  });

  it('returns a color matrix for styled filters', () => {
    expect(getPhotoFilterMatrix('bw')).toHaveLength(20);
    expect(getPhotoFilterMatrix('warm')).toHaveLength(20);
    expect(getPhotoFilterMatrix('cool')).toHaveLength(20);
    expect(getPhotoFilterMatrix('vivid')).toHaveLength(20);
  });
});
