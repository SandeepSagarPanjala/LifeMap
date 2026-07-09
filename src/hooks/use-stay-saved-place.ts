import { useEffect, useMemo, useState } from 'react';

import {
  getSavedPlaceById,
  type SavedPlaceRow,
} from '@/db/repositories/saved-places';
import { lookupSavedPlaceById } from '@/lib/saved-places';
import type { DetectedTrip } from '@/lib/trip-detection';

/** Active geofence match, or a trip-linked place that may be soft-deleted. */
export function useStaySavedPlace(
  stay: DetectedTrip | null,
  savedPlaces: readonly SavedPlaceRow[],
): SavedPlaceRow | null {
  const activeMatch = useMemo(
    () =>
      stay != null && stay.placeKind === 'saved'
        ? lookupSavedPlaceById(stay.placeId, savedPlaces)
        : null,
    [savedPlaces, stay],
  );
  const [linkedPlace, setLinkedPlace] = useState<SavedPlaceRow | null>(null);

  useEffect(() => {
    if (activeMatch != null) {
      setLinkedPlace(null);
      return;
    }
    const savedPlaceId = stay?.placeKind === 'saved' ? stay.placeId : undefined;
    if (savedPlaceId == null) {
      setLinkedPlace(null);
      return;
    }

    let cancelled = false;
    void getSavedPlaceById(savedPlaceId).then(place => {
      if (!cancelled) {
        setLinkedPlace(place);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [activeMatch, stay?.placeId, stay?.placeKind]);

  return activeMatch ?? linkedPlace;
}
