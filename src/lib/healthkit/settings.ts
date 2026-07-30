import { getSetting, setSetting } from '@/db/repositories/settings';

import { notifyHealthDataUpdated } from './events';
import {
  SETTINGS_KEY_HEALTHKIT_ACTIVITY,
  SETTINGS_KEY_HEALTHKIT_MASTER,
  SETTINGS_KEY_HEALTHKIT_SLEEP,
  SETTINGS_KEY_HEALTHKIT_STEPS,
} from './types';

export async function getHealthKitMasterEnabled(): Promise<boolean> {
  return (await getSetting(SETTINGS_KEY_HEALTHKIT_MASTER)) === 'true';
}

export async function setHealthKitMasterEnabled(
  enabled: boolean,
): Promise<void> {
  await setSetting(SETTINGS_KEY_HEALTHKIT_MASTER, enabled ? 'true' : 'false');
  notifyHealthDataUpdated();
}

/** Nested toggles default on once master is enabled. */
export async function getHealthKitSleepEnabled(): Promise<boolean> {
  return (await getSetting(SETTINGS_KEY_HEALTHKIT_SLEEP)) !== 'false';
}

export async function setHealthKitSleepEnabled(
  enabled: boolean,
): Promise<void> {
  await setSetting(SETTINGS_KEY_HEALTHKIT_SLEEP, enabled ? 'true' : 'false');
  notifyHealthDataUpdated();
}

export async function getHealthKitActivityEnabled(): Promise<boolean> {
  return (await getSetting(SETTINGS_KEY_HEALTHKIT_ACTIVITY)) !== 'false';
}

export async function setHealthKitActivityEnabled(
  enabled: boolean,
): Promise<void> {
  await setSetting(SETTINGS_KEY_HEALTHKIT_ACTIVITY, enabled ? 'true' : 'false');
  notifyHealthDataUpdated();
}

export async function getHealthKitStepsEnabled(): Promise<boolean> {
  return (await getSetting(SETTINGS_KEY_HEALTHKIT_STEPS)) !== 'false';
}

export async function setHealthKitStepsEnabled(
  enabled: boolean,
): Promise<void> {
  await setSetting(SETTINGS_KEY_HEALTHKIT_STEPS, enabled ? 'true' : 'false');
  notifyHealthDataUpdated();
}
