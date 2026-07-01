import {
  parsePlaceLookupCandidates,
  sanitizeCandidatesJson,
  sanitizePhotoAttachmentsJson,
} from '@/lib/db/json-blobs';

describe('json-blobs', () => {
  it('drops invalid photo attachment JSON', () => {
    expect(sanitizePhotoAttachmentsJson('not-json')).toBeNull();
    expect(sanitizePhotoAttachmentsJson('[{"path":""}]')).toBeNull();
  });

  it('keeps valid photo attachment JSON', () => {
    expect(
      sanitizePhotoAttachmentsJson('[{"path":"photos/a.jpg","bytes":120}]'),
    ).toBe('[{"path":"photos/a.jpg","bytes":120}]');
  });

  it('drops invalid place lookup candidate JSON', () => {
    expect(sanitizeCandidatesJson('{"bad":true}')).toBeNull();
    expect(parsePlaceLookupCandidates('[{"id":"1"}]')).toEqual([]);
  });

  it('keeps valid place lookup candidate JSON', () => {
    const raw =
      '[{"id":"poi-1","name":"Cafe","kind":"poi","distanceM":42}]';
    expect(parsePlaceLookupCandidates(raw)).toEqual([
      {id: 'poi-1', name: 'Cafe', kind: 'poi', distanceM: 42},
    ]);
    expect(sanitizeCandidatesJson(raw)).toBe(raw);
  });
});
