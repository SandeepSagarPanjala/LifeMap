import {useCallback, useEffect, useMemo, useState} from 'react';

import {
  listSavedPlaces,
  type SavedPlaceRow,
} from '@/db/repositories/saved-places';
import {syncSavedPlaceGeofences} from '@/location/geofence-registry';

export function useSavedPlaces(): {
  places: SavedPlaceRow[];
  loading: boolean;
  hasHome: boolean;
  hasWork: boolean;
  refresh: () => Promise<void>;
} {
  const [places, setPlaces] = useState<SavedPlaceRow[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const next = await listSavedPlaces();
    setPlaces(next);
    setLoading(false);
    await syncSavedPlaceGeofences(next);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const hasHome = useMemo(
    () => places.some(place => place.kind === 'home'),
    [places],
  );
  const hasWork = useMemo(
    () => places.some(place => place.kind === 'work'),
    [places],
  );

  return {places, loading, hasHome, hasWork, refresh};
}
