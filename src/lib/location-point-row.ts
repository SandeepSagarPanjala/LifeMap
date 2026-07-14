import type { LocationPointRow } from '@/db/repositories/location-days';

/** Null SDK extras for synthetic / rehydrated points that aren't raw Transistor Soft fixes. */
export const EMPTY_LOCATION_POINT_SDK_FIELDS = {
  heading: null,
  headingAccuracy: null,
  speedAccuracy: null,
  altitudeAccuracy: null,
  activityType: null,
  activityConfidence: null,
  isMoving: null,
  isMock: null,
  uuid: null,
  batteryLevel: null,
  batteryIsCharging: null,
} as const satisfies Omit<
  LocationPointRow,
  'id' | 'timestamp' | 'lat' | 'lng' | 'accuracy' | 'altitude' | 'speed' | 'source'
>;

/**
 * Build a full {@link LocationPointRow} for synthetic or rehydrated GPS.
 * Prefer this over object literals so new schema columns stay aligned.
 */
export function locationPointRow(
  partial: Partial<LocationPointRow> &
    Pick<LocationPointRow, 'id' | 'lat' | 'lng' | 'timestamp'>,
): LocationPointRow {
  return {
    accuracy: null,
    altitude: null,
    speed: null,
    source: 'gps',
    ...EMPTY_LOCATION_POINT_SDK_FIELDS,
    ...partial,
  };
}
