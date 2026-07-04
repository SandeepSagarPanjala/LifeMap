import {insertTrackingEvent} from '@/db/repositories/tracking-events';
import {countTrackingEvents} from '@/db/repositories/tracking-events';
import {getSetting, setSetting} from '@/db/repositories/settings';

/** Diagnostics are opt-in — they write to SQLite and can block location saves. */
export const SETTINGS_KEY_TRACKING_DIAGNOSTICS_ENABLED =
  'tracking_diagnostics_enabled';

const SETTINGS_KEY_TRACKING_DIAGNOSTICS_DEFAULT_OFF_REPAIR_V3 =
  'tracking_diagnostics_default_off_repair_v3';

/** Noisy events — at most one row per type per interval when diagnostics are on. */
const RATE_LIMIT_MS = 60_000;
const RATE_LIMITED_EVENTS = new Set([
  'heartbeat_checked',
  'motion_change',
  'provider_change',
  'native_queue_drained',
  'app_state_change',
  'geofence_sync',
]);

import {TRACKING_EVENTS_BLOAT_DISABLE_THRESHOLD} from '@/lib/app-constants';

export {TRACKING_EVENTS_BLOAT_DISABLE_THRESHOLD};

let cachedEnabled: boolean | null = null;
const lastLoggedAtMs = new Map<string, number>();

export async function getTrackingDiagnosticsEnabled(): Promise<boolean> {
  if (cachedEnabled != null) {
    return cachedEnabled;
  }

  return ensureTrackingDiagnosticsDefault();
}

async function ensureTrackingDiagnosticsDefault(): Promise<boolean> {
  const repairApplied = await getSetting(
    SETTINGS_KEY_TRACKING_DIAGNOSTICS_DEFAULT_OFF_REPAIR_V3,
  );
  if (repairApplied !== 'true') {
    cachedEnabled = false;
    await setSetting(SETTINGS_KEY_TRACKING_DIAGNOSTICS_ENABLED, 'false');
    await setSetting(SETTINGS_KEY_TRACKING_DIAGNOSTICS_DEFAULT_OFF_REPAIR_V3, 'true');
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
 * If diagnostics bloated the DB, turn them off so location saves are not starved.
 */
export async function disableDiagnosticsIfDatabaseBloated(): Promise<boolean> {
  try {
    const count = await countTrackingEvents();
    if (count < TRACKING_EVENTS_BLOAT_DISABLE_THRESHOLD) {
      return false;
    }
    await setTrackingDiagnosticsEnabled(false);
    return true;
  } catch {
    return false;
  }
}

export function initializeTrackingDiagnosticsEnabled(): void {
  cachedEnabled = null;
  void ensureTrackingDiagnosticsDefault()
    .then(() => disableDiagnosticsIfDatabaseBloated())
    .catch(() => {
      cachedEnabled = false;
    });
}

export function resetTrackingDiagnosticsForTests(): void {
  cachedEnabled = null;
  lastLoggedAtMs.clear();
}

function shouldRateLimit(event: string): boolean {
  if (!RATE_LIMITED_EVENTS.has(event)) {
    return false;
  }
  const last = lastLoggedAtMs.get(event) ?? 0;
  const now = Date.now();
  if (now - last < RATE_LIMIT_MS) {
    return true;
  }
  lastLoggedAtMs.set(event, now);
  return false;
}

export async function recordTrackingDiagnostic(
  event: string,
  details?: Record<string, unknown>,
): Promise<void> {
  try {
    const enabled = cachedEnabled ?? (await getTrackingDiagnosticsEnabled());
    if (!enabled || shouldRateLimit(event)) {
      return;
    }
    await insertTrackingEvent({event, details: details ?? null});
  } catch {
    // Diagnostics must never break tracking.
  }
}
