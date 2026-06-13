import {insertTrackingEvent} from '@/db/repositories/tracking-events';
import {getSetting, setSetting} from '@/db/repositories/settings';

/**
 * Tracking diagnostics are opt-in debug logging. They stay off unless the user
 * explicitly enables them in Settings.
 */
export const SETTINGS_KEY_TRACKING_DIAGNOSTICS_ENABLED =
  'tracking_diagnostics_enabled';

const SETTINGS_KEY_TRACKING_DIAGNOSTICS_DEFAULT_OFF_APPLIED =
  'tracking_diagnostics_default_off_applied_v1';

let cachedEnabled: boolean | null = null;

export async function getTrackingDiagnosticsEnabled(): Promise<boolean> {
  if (cachedEnabled != null) {
    return cachedEnabled;
  }

  return ensureTrackingDiagnosticsDefault();
}

async function ensureTrackingDiagnosticsDefault(): Promise<boolean> {
  const defaultOffApplied = await getSetting(
    SETTINGS_KEY_TRACKING_DIAGNOSTICS_DEFAULT_OFF_APPLIED,
  );
  if (defaultOffApplied !== 'true') {
    cachedEnabled = false;
    await setSetting(SETTINGS_KEY_TRACKING_DIAGNOSTICS_ENABLED, 'false');
    await setSetting(SETTINGS_KEY_TRACKING_DIAGNOSTICS_DEFAULT_OFF_APPLIED, 'true');
    return false;
  }

  const raw = await getSetting(SETTINGS_KEY_TRACKING_DIAGNOSTICS_ENABLED);
  if (raw === null) {
    cachedEnabled = false;
    await setSetting(SETTINGS_KEY_TRACKING_DIAGNOSTICS_ENABLED, 'false');
    return false;
  }

  cachedEnabled = raw === 'true';
  return cachedEnabled;
}

export async function setTrackingDiagnosticsEnabled(
  enabled: boolean,
): Promise<void> {
  cachedEnabled = enabled;
  await setSetting(
    SETTINGS_KEY_TRACKING_DIAGNOSTICS_ENABLED,
    enabled ? 'true' : 'false',
  );
}

/**
 * Warm up the cache and persist the default-off setting on first launch.
 */
export function initializeTrackingDiagnosticsEnabled(): void {
  cachedEnabled = null;
  void ensureTrackingDiagnosticsDefault().catch(() => {
    cachedEnabled = false;
  });
}

export function resetTrackingDiagnosticsForTests(): void {
  cachedEnabled = null;
}

export async function recordTrackingDiagnostic(
  event: string,
  details?: Record<string, unknown>,
): Promise<void> {
  try {
    const enabled = cachedEnabled ?? (await getTrackingDiagnosticsEnabled());
    if (!enabled) {
      return;
    }
    await insertTrackingEvent({event, details: details ?? null});
  } catch {
    // Diagnostics should never affect tracking behavior.
  }
}
