import { getSetting, setSetting } from '@/db/repositories/settings';

export const SETTINGS_KEY_BACKUP_AUTO_SCHEDULE = 'backup_auto_schedule';
export const SETTINGS_KEY_BACKUP_LAST_AT = 'backup_last_at';
export const SETTINGS_KEY_BACKUP_LAST_BYTES = 'backup_last_bytes';
export const SETTINGS_KEY_BACKUP_PREFS_INITIALIZED = 'backup_prefs_initialized';
export const SETTINGS_KEY_BACKUP_IN_PROGRESS = 'backup_in_progress';

export type BackupAutoSchedule = 'off' | 'daily' | 'weekly' | 'monthly';

const VALID_SCHEDULES = new Set<BackupAutoSchedule>([
  'off',
  'daily',
  'weekly',
  'monthly',
]);

const DAY_MS = 24 * 60 * 60 * 1000;

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

export async function recordBackupCompletion(
  totalBytes: number,
): Promise<void> {
  await setSetting(SETTINGS_KEY_BACKUP_LAST_AT, new Date().toISOString());
  await setSetting(SETTINGS_KEY_BACKUP_LAST_BYTES, String(totalBytes));
  await clearBackupInProgress();
}

/** Mark this schedule window as handled without uploading (dismiss / interrupt). */
export async function recordBackupSkip(): Promise<void> {
  await setSetting(SETTINGS_KEY_BACKUP_LAST_AT, new Date().toISOString());
  await clearBackupInProgress();
}

export async function isBackupInProgress(): Promise<boolean> {
  return (await getSetting(SETTINGS_KEY_BACKUP_IN_PROGRESS)) === 'true';
}

export async function markBackupInProgress(): Promise<void> {
  await setSetting(SETTINGS_KEY_BACKUP_IN_PROGRESS, 'true');
}

export async function clearBackupInProgress(): Promise<void> {
  await setSetting(SETTINGS_KEY_BACKUP_IN_PROGRESS, 'false');
}

/**
 * If a previous run was killed mid-backup, treat it as skipped for this
 * schedule window so the modal does not reopen forever.
 */
export async function clearInterruptedBackupIfNeeded(): Promise<boolean> {
  if (!(await isBackupInProgress())) {
    return false;
  }
  await recordBackupSkip();
  return true;
}

export function backupScheduleLabel(schedule: BackupAutoSchedule): string {
  switch (schedule) {
    case 'daily':
      return 'Daily';
    case 'weekly':
      return 'Weekly';
    case 'monthly':
      return 'Monthly';
    default:
      return 'Off';
  }
}

export function backupScheduleIntervalMs(
  schedule: BackupAutoSchedule,
): number | null {
  switch (schedule) {
    case 'daily':
      return DAY_MS;
    case 'weekly':
      return 7 * DAY_MS;
    case 'monthly':
      return 30 * DAY_MS;
    default:
      return null;
  }
}

export function isBackupDue(
  schedule: BackupAutoSchedule,
  lastAt: Date | null,
  now: Date = new Date(),
): boolean {
  const intervalMs = backupScheduleIntervalMs(schedule);
  if (intervalMs == null) {
    return false;
  }
  if (lastAt == null) {
    return true;
  }
  return now.getTime() - lastAt.getTime() >= intervalMs;
}

export async function areBackupPrefsInitialized(): Promise<boolean> {
  return (await getSetting(SETTINGS_KEY_BACKUP_PREFS_INITIALIZED)) === 'true';
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
