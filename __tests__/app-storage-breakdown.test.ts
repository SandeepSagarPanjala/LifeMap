import {momentTypeLabel} from '../src/lib/app-storage-breakdown';

describe('momentTypeLabel', () => {
  it('labels grouped moment storage rows', () => {
    expect(momentTypeLabel('photo')).toBe('Camera');
    expect(momentTypeLabel('voice')).toBe('Voice');
    expect(momentTypeLabel('note')).toBe('Note');
    expect(momentTypeLabel('video')).toBe('Video');
  });
});
