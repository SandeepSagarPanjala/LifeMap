import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';

import type { SavedPlaceRow } from '@/db/repositories/saved-places';
import {
  buildDayStoryStops,
  type DayStoryStop,
} from '@/lib/day-story-stops';
import type { DetectedTrip } from '@/lib/trip-detection';
import {
  getMaterializationRevision,
  subscribeMaterialization,
} from '@/lib/trip-materialization-events';
import { loadVisitPlaceDisplayForStay } from '@/lib/visit-place-label';

/**
 * Apply DB / visit-override resolution onto a timeline stay so day-story
 * matches History (timeline entries often keep the first closest-POI label).
 */
export async function enrichStayPlaceFieldsFromVisitDisplay(
  stay: DetectedTrip,
  savedPlaces: readonly SavedPlaceRow[],
): Promise<DetectedTrip> {
  const display = await loadVisitPlaceDisplayForStay(stay, savedPlaces);

  if (display.source === 'saved') {
    return {
      ...stay,
      placeKind: 'saved',
      placeLabel: display.primaryLabel ?? stay.placeLabel,
      poiId: undefined,
      poiLabel: undefined,
      poiCategory: undefined,
      materializedTripId:
        display.materializedTripId ?? stay.materializedTripId,
    };
  }

  const selected =
    display.selectedPoiId != null
      ? display.candidates.find(
          candidate => candidate.id === display.selectedPoiId,
        )
      : undefined;

  return {
    ...stay,
    placeKind:
      display.cacheId != null ? 'cache' : stay.placeKind,
    placeId: display.cacheId ?? stay.placeId,
    placeLabel: display.addressLabel ?? stay.placeLabel,
    poiId: display.selectedPoiId ?? stay.poiId,
    poiLabel:
      selected?.name ?? display.primaryLabel ?? stay.poiLabel,
    poiCategory: selected?.category ?? stay.poiCategory,
    materializedTripId:
      display.materializedTripId ?? stay.materializedTripId,
  };
}

/**
 * Day-story stops with History-aligned place labels (re-read trip + overrides).
 */
export function useDayStoryStops(
  enabled: boolean,
  stays: readonly DetectedTrip[],
  savedPlaces: readonly SavedPlaceRow[],
  groupRadiusMeters: number,
): DayStoryStop[] {
  const syncStops = useMemo(
    () =>
      enabled
        ? buildDayStoryStops(stays, savedPlaces, groupRadiusMeters)
        : [],
    [enabled, stays, savedPlaces, groupRadiusMeters],
  );

  const [stops, setStops] = useState(syncStops);
  const materializationRevision = useSyncExternalStore(
    subscribeMaterialization,
    getMaterializationRevision,
    getMaterializationRevision,
  );

  useEffect(() => {
    setStops(syncStops);
  }, [syncStops]);

  useEffect(() => {
    if (!enabled || stays.length === 0) {
      return;
    }

    let cancelled = false;
    void (async () => {
      const enriched = await Promise.all(
        stays.map(stay =>
          enrichStayPlaceFieldsFromVisitDisplay(stay, savedPlaces),
        ),
      );
      if (cancelled) {
        return;
      }
      setStops(buildDayStoryStops(enriched, savedPlaces, groupRadiusMeters));
    })();

    return () => {
      cancelled = true;
    };
  }, [
    enabled,
    stays,
    savedPlaces,
    groupRadiusMeters,
    materializationRevision,
  ]);

  return enabled ? stops : [];
}
