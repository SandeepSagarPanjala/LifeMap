import {
  momentSandboxPath,
  momentsRootDirectory,
  MOMENTS_DIRECTORY,
} from '../src/lib/moments/moment-storage';

describe('moment storage paths', () => {
  it('builds sandbox paths under Documents/moments', () => {
    const documentDir = '/var/mobile/Documents';
    expect(momentsRootDirectory(documentDir)).toBe(
      '/var/mobile/Documents/moments',
    );
    expect(momentSandboxPath(documentDir, 'abc-123', 'jpg')).toBe(
      '/var/mobile/Documents/moments/abc-123.jpg',
    );
    expect(MOMENTS_DIRECTORY).toBe('moments');
  });
});
