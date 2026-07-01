import {getSetting, setSetting} from '@/db/repositories/settings';

export const SETTINGS_KEY_DRIVE_MAP_REFRESH_INTERVAL_MS =
  'drive_map_refresh_interval_ms';

export type DriveMapRefreshIntervalMs = 10_000 | 30_000 | 60_000;

export const DRIVE_MAP_REFRESH_INTERVAL_OPTIONS: ReadonlyArray<{
  ms: DriveMapRefreshIntervalMs;
  label: string;
}> = [
  {ms: 10_000, label: '10 seconds'},
  {ms: 30_000, label: '30 seconds'},
  {ms: 60_000, label: '1 minute'},
];

export const DEFAULT_DRIVE_MAP_REFRESH_INTERVAL_MS: DriveMapRefreshIntervalMs =
  30_000;

export function driveMapRefreshIntervalLabel(ms: number): string {
  return (
    DRIVE_MAP_REFRESH_INTERVAL_OPTIONS.find(option => option.ms === ms)
      ?.label ?? DRIVE_MAP_REFRESH_INTERVAL_OPTIONS[1]!.label
  );
}

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
