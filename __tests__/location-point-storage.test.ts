import {locationPointTimestampToStorageValue} from '@/lib/location-point-storage';

describe('locationPointTimestampToStorageValue', () => {
  it('stores unix seconds like drizzle timestamp mode', () => {
    const date = new Date('2026-06-12T13:54:00.000Z');
    expect(locationPointTimestampToStorageValue(date)).toBe(
      Math.floor(date.getTime() / 1000),
    );
  });
});
