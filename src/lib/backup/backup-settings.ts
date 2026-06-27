import {getSetting, setSetting} from '@/db/repositories/settings';

export const SETTINGS_KEY_BACKUP_AUTO_SCHEDULE = 'backup_auto_schedule';
export const SETTINGS_KEY_BACKUP_LAST_AT = 'backup_last_at';
export const SETTINGS_KEY_BACKUP_LAST_BYTES = 'backup_last_bytes';
export const SETTINGS_KEY_BACKUP_PREFS_INITIALIZED = 'backup_prefs_initialized';

export type BackupAutoSchedule = 'off' | 'daily' | 'weekly';

const VALID_SCHEDULES = new Set<BackupAutoSchedule>(['off', 'daily', 'weekly']);

export async function getBackupAutoSchedule(): Promise<BackupAutoSchedule> {
  const value = await getSetting(SETTINGS_KEY_BACKUP_AUTO_SCHEDULE);
  if (value != null && VALID_SCHEDULES.has(value as BackupAutoSchedule)) {
    return value as BackupAutoSchedule;
  }
  return 'off';
}

export async function setBackupAutoSchedule(
  schedule: BackupAutoSchedule,
): Promise<void> {
  await setSetting(SETTINGS_KEY_BACKUP_AUTO_SCHEDULE, schedule);
}

export async function getBackupLastAt(): Promise<Date | null> {
  const value = await getSetting(SETTINGS_KEY_BACKUP_LAST_AT);
  if (!value) {
    return null;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export async function getBackupLastBytes(): Promise<number> {
  const value = await getSetting(SETTINGS_KEY_BACKUP_LAST_BYTES);
  if (!value) {
    return 0;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export async function recordBackupCompletion(totalBytes: number): Promise<void> {
  await setSetting(SETTINGS_KEY_BACKUP_LAST_AT, new Date().toISOString());
  await setSetting(SETTINGS_KEY_BACKUP_LAST_BYTES, String(totalBytes));
}

export function backupScheduleLabel(schedule: BackupAutoSchedule): string {
  switch (schedule) {
    case 'daily':
      return 'Daily';
    case 'weekly':
      return 'Weekly';
    default:
      return 'Off';
  }
}

export function isBackupDue(
  schedule: BackupAutoSchedule,
  lastAt: Date | null,
  now: Date = new Date(),
): boolean {
  if (schedule === 'off') {
    return false;
  }
  if (lastAt == null) {
    return true;
  }
  const elapsedMs = now.getTime() - lastAt.getTime();
  const dayMs = 24 * 60 * 60 * 1000;
  if (schedule === 'daily') {
    return elapsedMs >= dayMs;
  }
  return elapsedMs >= 7 * dayMs;
}

/** First launch on a device with no cloud backup: keep auto backup off until user opts in. */
export async function initializeBackupPreferencesOnLaunch(
  cloudBackupExists: boolean,
): Promise<void> {
  const existing = await getSetting(SETTINGS_KEY_BACKUP_PREFS_INITIALIZED);
  if (existing === 'true') {
    return;
  }

  if (!cloudBackupExists) {
    await setBackupAutoSchedule('off');
  }

  await setSetting(SETTINGS_KEY_BACKUP_PREFS_INITIALIZED, 'true');
}
