import { useEffect, useRef, useState, useSyncExternalStore } from 'react';

import type { SavedPlaceRow } from '@/db/repositories/saved-places';
import {
  resolveAndPersistPlaceLabelForStay,
  stayNeedsLazyPlaceLookup,
} from '@/lib/place-lookup-resolve';
import {
  getPlaceLookupRevision,
  subscribePlaceLookup,
} from '@/lib/place-lookup-events';
import {
  getMaterializationRevision,
  subscribeMaterialization,
} from '@/lib/trip-materialization-events';
import type { DetectedTrip } from '@/lib/trip-detection';

/** MapKit lookup when the user selects an unlabeled sealed stay in history. */
export function useResolvePlaceOnStaySelect(
  stay: DetectedTrip | null,
  dateKey: string,
  savedPlaces: readonly SavedPlaceRow[],
  enabled: boolean,
): boolean {
  const placeRevision = useSyncExternalStore(
    subscribePlaceLookup,
    getPlaceLookupRevision,
    getPlaceLookupRevision,
  );
  const materializationRevision = useSyncExternalStore(
    subscribeMaterialization,
    getMaterializationRevision,
    getMaterializationRevision,
  );
  const [resolving, setResolving] = useState(false);
  const inFlightKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!enabled || stay == null) {
      setResolving(false);
      return;
    }

    if (!stayNeedsLazyPlaceLookup(stay, savedPlaces)) {
      setResolving(false);
      inFlightKeyRef.current = null;
      return;
    }

    const key = stay.id;
    if (inFlightKeyRef.current === key) {
      return;
    }

    inFlightKeyRef.current = key;
    setResolving(true);
    let cancelled = false;

    void resolveAndPersistPlaceLabelForStay(stay, dateKey, { savedPlaces })
      .catch(() => undefined)
      .finally(() => {
        if (cancelled) {
          return;
        }
        if (inFlightKeyRef.current === key) {
          inFlightKeyRef.current = null;
        }
        setResolving(false);
      });

    return () => {
      cancelled = true;
    };
  }, [
    enabled,
    stay,
    dateKey,
    savedPlaces,
    placeRevision,
    materializationRevision,
  ]);

  return resolving;
}
