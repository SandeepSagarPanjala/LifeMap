import { getSetting, setSetting } from '@/db/repositories/settings';

import { notifyHealthDataUpdated } from './events';
import {
  SETTINGS_KEY_HEALTHKIT_ACTIVITY,
  SETTINGS_KEY_HEALTHKIT_LAST_SYNC_AT,
  SETTINGS_KEY_HEALTHKIT_MASTER,
  SETTINGS_KEY_HEALTHKIT_SLEEP,
  SETTINGS_KEY_HEALTHKIT_STEPS,
  SETTINGS_KEY_HEALTHKIT_SYNC_ON_CHANGES,
  SETTINGS_KEY_HEALTHKIT_SYNC_ON_DETAIL_OPEN,
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

/** Opt-in HealthKit observer sync. Unset = off. */
export async function getHealthKitSyncOnChangesEnabled(): Promise<boolean> {
  return (await getSetting(SETTINGS_KEY_HEALTHKIT_SYNC_ON_CHANGES)) === 'true';
}

export async function setHealthKitSyncOnChangesEnabled(
  enabled: boolean,
): Promise<void> {
  await setSetting(
    SETTINGS_KEY_HEALTHKIT_SYNC_ON_CHANGES,
    enabled ? 'true' : 'false',
  );
}

/** Opt-in sync when opening Sleep/Steps detail. Unset = off. */
export async function getHealthKitSyncOnDetailOpenEnabled(): Promise<boolean> {
  return (
    (await getSetting(SETTINGS_KEY_HEALTHKIT_SYNC_ON_DETAIL_OPEN)) === 'true'
  );
}

export async function setHealthKitSyncOnDetailOpenEnabled(
  enabled: boolean,
): Promise<void> {
  await setSetting(
    SETTINGS_KEY_HEALTHKIT_SYNC_ON_DETAIL_OPEN,
    enabled ? 'true' : 'false',
  );
}

/** Null until the first successful sync, which means the next sync backfills. */
export async function getHealthKitLastSyncAt(): Promise<Date | null> {
  const raw = await getSetting(SETTINGS_KEY_HEALTHKIT_LAST_SYNC_AT);
  if (raw == null) {
    return null;
  }
  const ms = Number(raw);
  if (!Number.isFinite(ms)) {
    return null;
  }
  return new Date(ms);
}

export async function setHealthKitLastSyncAt(at: Date): Promise<void> {
  await setSetting(
    SETTINGS_KEY_HEALTHKIT_LAST_SYNC_AT,
    String(at.getTime()),
  );
}
