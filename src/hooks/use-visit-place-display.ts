import {useCallback, useEffect, useState, useSyncExternalStore} from 'react';

import {findPlaceLookupNearAnchor} from '@/db/repositories/place-lookup-cache';
import type {SavedPlaceRow} from '@/db/repositories/saved-places';
import {
  resolveVisitPlaceDisplay,
  savedPlaceVisitDisplay,
} from '@/lib/place-lookup-display';
import {
  getPlaceLookupRevision,
  subscribePlaceLookup,
} from '@/lib/place-lookup-events';
import type {VisitPlaceDisplay} from '@/lib/place-lookup-types';
import {matchSavedPlaceForStay} from '@/lib/saved-places';
import type {DetectedTrip} from '@/lib/trip-detection';
import {stayTripCentroid} from '@/lib/trip-detection';

const EMPTY_DISPLAY: VisitPlaceDisplay = {
  source: 'none',
  primaryLabel: null,
  candidates: [],
  selectedIndex: 0,
  cacheId: null,
  loading: false,
};

export function useVisitPlaceDisplay(
  stay: DetectedTrip | null,
  savedPlaces: SavedPlaceRow[],
): VisitPlaceDisplay {
  const revision = useSyncExternalStore(
    subscribePlaceLookup,
    getPlaceLookupRevision,
    getPlaceLookupRevision,
  );
  const [display, setDisplay] = useState<VisitPlaceDisplay>(EMPTY_DISPLAY);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!stay) {
        if (!cancelled) {
          setDisplay(EMPTY_DISPLAY);
        }
        return;
      }

      const savedPlace = matchSavedPlaceForStay(stay, savedPlaces);
      if (savedPlace) {
        if (!cancelled) {
          setDisplay(savedPlaceVisitDisplay(savedPlace));
        }
        return;
      }

      const anchor = stayTripCentroid(stay);
      const row = await findPlaceLookupNearAnchor({
        lat: anchor.latitude,
        lng: anchor.longitude,
      });
      if (!cancelled) {
        setDisplay(resolveVisitPlaceDisplay(row));
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [stay, savedPlaces, revision]);

  return display;
}

export function useSelectVisitPlaceCandidate() {
  return useCallback(async (cacheId: number, selectedIndex: number) => {
    const {setPlaceLookupSelectedIndex} = await import(
      '@/db/repositories/place-lookup-cache'
    );
    const {notifyPlaceLookupUpdated} = await import('@/lib/place-lookup-events');
    await setPlaceLookupSelectedIndex(cacheId, selectedIndex);
    notifyPlaceLookupUpdated();
  }, []);
}
