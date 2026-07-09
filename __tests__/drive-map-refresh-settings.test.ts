import { DEFAULT_DRIVE_MAP_REFRESH_INTERVAL_MS } from '@/lib/app-constants';
import { driveMapRefreshIntervalLabel } from '@/lib/app-copy';
import { normalizeDriveMapRefreshIntervalMs } from '@/lib/drive-map-refresh-settings';

describe('drive map refresh settings', () => {
  it('defaults to 30 seconds', () => {
    expect(normalizeDriveMapRefreshIntervalMs(null)).toBe(
      DEFAULT_DRIVE_MAP_REFRESH_INTERVAL_MS,
    );
    expect(driveMapRefreshIntervalLabel(30_000)).toBe('30 seconds');
  });

  it('normalizes supported intervals', () => {
    expect(normalizeDriveMapRefreshIntervalMs('10000')).toBe(10_000);
    expect(normalizeDriveMapRefreshIntervalMs('60000')).toBe(60_000);
    expect(normalizeDriveMapRefreshIntervalMs('99999')).toBe(30_000);
  });
});
