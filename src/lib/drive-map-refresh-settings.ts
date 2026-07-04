import {getSetting, setSetting} from '@/db/repositories/settings';
import {
  DEFAULT_DRIVE_MAP_REFRESH_INTERVAL_MS,
  DRIVE_MAP_REFRESH_INTERVAL_MS_OPTIONS,
  SETTINGS_KEY_DRIVE_MAP_REFRESH_INTERVAL_MS,
  type DriveMapRefreshIntervalMs,
} from '@/lib/app-constants';
import {driveMapRefreshIntervalLabel} from '@/lib/app-copy';

export {
  DEFAULT_DRIVE_MAP_REFRESH_INTERVAL_MS,
  SETTINGS_KEY_DRIVE_MAP_REFRESH_INTERVAL_MS,
  type DriveMapRefreshIntervalMs,
};

export const DRIVE_MAP_REFRESH_INTERVAL_OPTIONS: ReadonlyArray<{
  ms: DriveMapRefreshIntervalMs;
  label: string;
}> = DRIVE_MAP_REFRESH_INTERVAL_MS_OPTIONS.map(ms => ({
  ms,
  label: driveMapRefreshIntervalLabel(ms),
}));

export {driveMapRefreshIntervalLabel};

export function normalizeDriveMapRefreshIntervalMs(
  raw: string | null,
): DriveMapRefreshIntervalMs {
  const parsed = Number(raw);
  if (parsed === 10_000 || parsed === 30_000 || parsed === 60_000) {
    return parsed;
  }
  return DEFAULT_DRIVE_MAP_REFRESH_INTERVAL_MS;
}

export async function getDriveMapRefreshIntervalMs(): Promise<DriveMapRefreshIntervalMs> {
  const raw = await getSetting(SETTINGS_KEY_DRIVE_MAP_REFRESH_INTERVAL_MS);
  return normalizeDriveMapRefreshIntervalMs(raw);
}

export async function setDriveMapRefreshIntervalMs(
  ms: DriveMapRefreshIntervalMs,
): Promise<void> {
  await setSetting(SETTINGS_KEY_DRIVE_MAP_REFRESH_INTERVAL_MS, String(ms));
}
