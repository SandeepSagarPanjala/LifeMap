import {listSavedPlaces, type SavedPlaceRow} from '@/db/repositories/saved-places';
import {GEOFENCE_WAKE_MIN_RADIUS_METERS} from '@/lib/app-constants';
import {nativeSyncGeofences, type NativeGeofenceSpec} from '@/location/native-location-persist';
import {recordTrackingDiagnostic} from '@/lib/tracking-diagnostics';

/** iOS geofence wake radius — Apple is unreliable below ~100 m. */
export {GEOFENCE_WAKE_MIN_RADIUS_METERS};

export function savedPlaceGeofenceSpecs(
  places: readonly SavedPlaceRow[],
): NativeGeofenceSpec[] {
  return places.map(place => ({
    identifier: `saved-place-${place.id}`,
    lat: place.lat,
    lng: place.lng,
    radiusMeters: Math.max(place.radiusMeters, GEOFENCE_WAKE_MIN_RADIUS_METERS),
  }));
}

export async function syncSavedPlaceGeofences(
  places?: readonly SavedPlaceRow[],
): Promise<number> {
  const rows = places ?? (await listSavedPlaces());
  const specs = savedPlaceGeofenceSpecs(rows);
  const synced = await nativeSyncGeofences(specs);
  await recordTrackingDiagnostic('geofence_sync', {
    count: synced,
    places: specs.map(spec => spec.identifier),
  });
  return synced;
}
