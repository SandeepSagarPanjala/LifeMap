import {insertTrackingEvent} from '@/db/repositories/tracking-events';
import {getSetting, setSetting} from '@/db/repositories/settings';

/**
 * Tracking diagnostics enablement is a runtime setting so TestFlight can turn it on
 * without requiring a rebuild.
 */
export const SETTINGS_KEY_TRACKING_DIAGNOSTICS_ENABLED =
  'tracking_diagnostics_enabled';

let cachedEnabled: boolean | null = null;

export async function getTrackingDiagnosticsEnabled(): Promise<boolean> {
  if (cachedEnabled != null) {
    return cachedEnabled;
  }

  const raw = await getSetting(SETTINGS_KEY_TRACKING_DIAGNOSTICS_ENABLED);
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
 * Warm up the cache. Safe to call during app bootstrap.
 */
export function initializeTrackingDiagnosticsEnabled(): void {
  cachedEnabled = null;
  void getTrackingDiagnosticsEnabled().catch(() => undefined);
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
