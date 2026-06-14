import {insertTrackingEvent} from '@/db/repositories/tracking-events';
import {getSetting, setSetting} from '@/db/repositories/settings';

/** Diagnostics help debug missed drives and heartbeat gaps in exports. */
export const SETTINGS_KEY_TRACKING_DIAGNOSTICS_ENABLED =
  'tracking_diagnostics_enabled';

const SETTINGS_KEY_TRACKING_DIAGNOSTICS_DEFAULT_ON_APPLIED =
  'tracking_diagnostics_default_on_applied_v2';

let cachedEnabled: boolean | null = null;

export async function getTrackingDiagnosticsEnabled(): Promise<boolean> {
  if (cachedEnabled != null) {
    return cachedEnabled;
  }

  return ensureTrackingDiagnosticsDefault();
}

async function ensureTrackingDiagnosticsDefault(): Promise<boolean> {
  const defaultOnApplied = await getSetting(
    SETTINGS_KEY_TRACKING_DIAGNOSTICS_DEFAULT_ON_APPLIED,
  );
  if (defaultOnApplied !== 'true') {
    cachedEnabled = true;
    await setSetting(SETTINGS_KEY_TRACKING_DIAGNOSTICS_ENABLED, 'true');
    await setSetting(SETTINGS_KEY_TRACKING_DIAGNOSTICS_DEFAULT_ON_APPLIED, 'true');
    return true;
  }

  const raw = await getSetting(SETTINGS_KEY_TRACKING_DIAGNOSTICS_ENABLED);
  if (raw === null) {
    cachedEnabled = true;
    await setSetting(SETTINGS_KEY_TRACKING_DIAGNOSTICS_ENABLED, 'true');
    return true;
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
 * Warm up the cache and persist the default-on setting on first launch.
 */
export function initializeTrackingDiagnosticsEnabled(): void {
  cachedEnabled = null;
  void ensureTrackingDiagnosticsDefault().catch(() => {
    cachedEnabled = true;
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
    // Diagnostics must never break tracking.
  }
}
