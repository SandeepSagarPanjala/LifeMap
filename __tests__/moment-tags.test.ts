import {
  MAX_PHOTO_TAGS,
  normalizePhotoTag,
  parseMomentTagsJson,
  sanitizePhotoTags,
  serializeMomentTagsJson,
} from '@/lib/moments/moment-tags';

describe('moment-tags', () => {
  it('normalizes and drops useless labels', () => {
    expect(normalizePhotoTag('  LAKE  ')).toBe('Lake');
    expect(normalizePhotoTag('photograph')).toBeNull();
    expect(normalizePhotoTag('')).toBeNull();
  });

  it('caps at MAX_PHOTO_TAGS and dedupes', () => {
    const tags = sanitizePhotoTags([
      'Lake',
      'lake',
      'Outdoors',
      'Water',
      'Nature',
      'Sky',
      'Tree',
      'Mountain',
      'Beach',
      'Forest',
      'photo',
    ]);
    expect(tags).toEqual([
      'Lake',
      'Outdoors',
      'Water',
      'Nature',
      'Sky',
      'Tree',
      'Mountain',
      'Beach',
    ]);
    expect(tags).toHaveLength(MAX_PHOTO_TAGS);
  });

  it('round-trips JSON', () => {
    const json = serializeMomentTagsJson(['Lake', 'Water']);
    expect(json).toBe(JSON.stringify(['Lake', 'Water']));
    expect(parseMomentTagsJson(json)).toEqual(['Lake', 'Water']);
    expect(parseMomentTagsJson(null)).toEqual([]);
    expect(parseMomentTagsJson('not-json')).toEqual([]);
  });
});
