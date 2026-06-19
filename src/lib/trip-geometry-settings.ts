import {getSetting, setSetting} from '@/db/repositories/settings';

import {TRIP_GEOMETRY_VERSION} from '@/lib/trip-settings';

export const SETTINGS_KEY_CANONICAL_TRAVEL_GEOMETRY =
  'trip_canonical_travel_geometry';

let cachedEnabled: boolean | null = null;

/** Default on — turn-anchored simplification when persisting drive routes. */
export async function isCanonicalTravelGeometryEnabled(): Promise<boolean> {
  if (cachedEnabled != null) {
    return cachedEnabled;
  }
  const stored = await getSetting(SETTINGS_KEY_CANONICAL_TRAVEL_GEOMETRY);
  cachedEnabled = stored === null ? true : stored === 'true';
  return cachedEnabled;
}

export function getCanonicalTravelGeometryEnabledSync(): boolean {
  return cachedEnabled ?? true;
}

export async function setCanonicalTravelGeometryEnabled(
  enabled: boolean,
): Promise<void> {
  cachedEnabled = enabled;
  await setSetting(
    SETTINGS_KEY_CANONICAL_TRAVEL_GEOMETRY,
    enabled ? 'true' : 'false',
  );
}

/** @internal — tests */
export function resetCanonicalTravelGeometryCacheForTests(): void {
  cachedEnabled = null;
}

export async function warmCanonicalTravelGeometrySetting(): Promise<boolean> {
  return isCanonicalTravelGeometryEnabled();
}

/** Stamp stored on materialized_days — invalidates fast load when settings change. */
export async function getGeometryPersistFingerprint(): Promise<string> {
  const travel = await isCanonicalTravelGeometryEnabled();
  return `${TRIP_GEOMETRY_VERSION}|travel:${travel ? 1 : 0}`;
}
