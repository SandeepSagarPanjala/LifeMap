import { formatStorageBytes } from '../src/lib/format-storage';

describe('formatStorageBytes', () => {
  it('formats bytes, kilobytes, and megabytes', () => {
    expect(formatStorageBytes(0)).toBe('0 B');
    expect(formatStorageBytes(512)).toBe('512 B');
    expect(formatStorageBytes(2048)).toBe('2.0 KB');
    expect(formatStorageBytes(2_621_440)).toBe('2.50 MB');
  });
});
