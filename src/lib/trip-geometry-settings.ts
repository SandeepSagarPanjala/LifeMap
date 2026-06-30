import {TRIP_GEOMETRY_VERSION} from '@/lib/trip-settings';

/** Canonical drive geometry is always enabled — not user-configurable. */
export async function isCanonicalTravelGeometryEnabled(): Promise<boolean> {
  return true;
}

export function getCanonicalTravelGeometryEnabledSync(): boolean {
  return true;
}

/** @internal — tests only; no-op in production (always on). */
export async function setCanonicalTravelGeometryEnabled(
  _enabled: boolean,
): Promise<void> {
  // kept for test compatibility
}

/** @internal — tests */
export function resetCanonicalTravelGeometryCacheForTests(): void {
  // no-op
}

export async function warmCanonicalTravelGeometrySetting(): Promise<boolean> {
  return true;
}

/** Stamp stored on materialized_days — invalidates fast load when settings change. */
export async function getGeometryPersistFingerprint(): Promise<string> {
  return `${TRIP_GEOMETRY_VERSION}|travel:1`;
}
