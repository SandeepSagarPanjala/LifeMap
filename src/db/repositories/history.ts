import {getSetting, setSetting} from '@/db/repositories/settings';

export const SETTINGS_KEY_HISTORY_START_AT = 'history_start_at';

/** When LifeMap was first installed (privacy onboarding / first open). */
export async function ensureHistoryStartRecorded(): Promise<Date> {
  const stored = await getSetting(SETTINGS_KEY_HISTORY_START_AT);
  if (stored != null) {
    return new Date(stored);
  }

  const now = new Date();
  await setSetting(SETTINGS_KEY_HISTORY_START_AT, now.toISOString());
  return now;
}

export async function getHistoryStartAt(): Promise<Date> {
  const stored = await getSetting(SETTINGS_KEY_HISTORY_START_AT);
  if (stored != null) {
    return new Date(stored);
  }
  return ensureHistoryStartRecorded();
}
