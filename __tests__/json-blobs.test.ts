import { sanitizePhotoAttachmentsJson } from '@/lib/db/json-blobs';

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
});
