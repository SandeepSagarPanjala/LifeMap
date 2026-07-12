import {
  parsePlaceLookupCandidates,
  sanitizeCandidatesJson,
  sanitizePhotoAttachmentsJson,
  serializePlaceLookupCandidates,
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
    expect(
      parsePlaceLookupCandidates(
        '[{"id":"poi-1","name":"Cafe","kind":"poi","distanceM":null}]',
      ),
    ).toEqual([]);
  });

  it('rejects non-finite distanceM values', () => {
    expect(
      parsePlaceLookupCandidates(
        '[{"id":"poi-1","name":"Cafe","kind":"poi","distanceM":null}]',
      ),
    ).toEqual([]);
    expect(
      parsePlaceLookupCandidates(
        '[{"id":"poi-1","name":"Cafe","kind":"poi","distanceM":1e309}]',
      ),
    ).toEqual([]);
  });

  it('keeps valid place lookup candidate JSON', () => {
    const raw =
      '[{"id":"poi-1","name":"Cafe","kind":"poi","distanceM":42,"lat":33.2,"lng":-97.1,"category":"MKPOICategoryCafe"}]';
    expect(parsePlaceLookupCandidates(raw)).toEqual([
      {
        id: 'poi-1',
        name: 'Cafe',
        kind: 'poi',
        distanceM: 42,
        lat: 33.2,
        lng: -97.1,
        category: 'MKPOICategoryCafe',
      },
    ]);
    expect(sanitizeCandidatesJson(raw)).toBe(
      '[{"id":"poi-1","name":"Cafe","kind":"poi","distanceM":42,"lat":33.2,"lng":-97.1,"category":"MKPOICategoryCafe"}]',
    );
  });

  it('serializes typed place lookup candidates on write', () => {
    expect(
      serializePlaceLookupCandidates([
        {
          id: 'poi-1',
          name: 'Cafe',
          kind: 'poi',
          distanceM: 42,
          lat: 33.2,
          lng: -97.1,
          category: 'MKPOICategoryCafe',
        },
      ]),
    ).toBe(
      '[{"id":"poi-1","name":"Cafe","kind":"poi","distanceM":42,"lat":33.2,"lng":-97.1,"category":"MKPOICategoryCafe"}]',
    );
    expect(serializePlaceLookupCandidates([])).toBeNull();
  });
});
