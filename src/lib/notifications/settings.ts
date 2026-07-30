import { getSetting, setSetting } from '@/db/repositories/settings';

import type { PlaceNotifyMode } from './types';

export const SETTINGS_KEY_NOTIFICATIONS_MASTER = 'notifications_master';
export const SETTINGS_KEY_NOTIFICATIONS_PLACE_MODE = 'notifications_place_mode';
export const SETTINGS_KEY_NOTIFICATIONS_ACTIVITY =
  'notifications_activity_enabled';
export const SETTINGS_KEY_PLACE_PROMPT_LAST_STAY =
  'notifications_place_last_stay_key';

export async function getNotificationsMasterEnabled(): Promise<boolean> {
  return (await getSetting(SETTINGS_KEY_NOTIFICATIONS_MASTER)) === 'true';
}

export async function setNotificationsMasterEnabled(
  enabled: boolean,
): Promise<void> {
  await setSetting(
    SETTINGS_KEY_NOTIFICATIONS_MASTER,
    enabled ? 'true' : 'false',
  );
}

export async function getPlaceNotifyMode(): Promise<PlaceNotifyMode> {
  const value = await getSetting(SETTINGS_KEY_NOTIFICATIONS_PLACE_MODE);
  if (value === 'new_place') {
    return 'new_place';
  }
  // Safer default: fewer prompts when the master switch is first enabled.
  return 'unique_place';
}

export async function setPlaceNotifyMode(mode: PlaceNotifyMode): Promise<void> {
  await setSetting(SETTINGS_KEY_NOTIFICATIONS_PLACE_MODE, mode);
}

export async function getActivityNotificationsEnabled(): Promise<boolean> {
  const value = await getSetting(SETTINGS_KEY_NOTIFICATIONS_ACTIVITY);
  // Default on when unset so first enable of master isn't a second surprise.
  return value !== 'false';
}

export async function setActivityNotificationsEnabled(
  enabled: boolean,
): Promise<void> {
  await setSetting(
    SETTINGS_KEY_NOTIFICATIONS_ACTIVITY,
    enabled ? 'true' : 'false',
  );
}

export async function getLastPlacePromptStayKey(): Promise<string | null> {
  return getSetting(SETTINGS_KEY_PLACE_PROMPT_LAST_STAY);
}

export async function setLastPlacePromptStayKey(
  stayKey: string,
): Promise<void> {
  await setSetting(SETTINGS_KEY_PLACE_PROMPT_LAST_STAY, stayKey);
}
