import {useEffect, useRef} from 'react';
import {AppState, type AppStateStatus} from 'react-native';

import type {SavedPlaceRow} from '@/db/repositories/saved-places';
import {runWhenIdle} from '@/lib/run-when-idle';
import {
  enqueuePlaceLookupForStay,
  enqueuePlaceLookupsForStays,
  resetPlaceLookupSessionBudget,
  shouldSkipPlaceLookupForStay,
  stayQualifiesForPlaceLookup,
} from '@/lib/place-lookup-service';
import {ensureTripForClosedStay} from '@/lib/trip-materialization';
import type {TripDetectionConfig} from '@/lib/trip-settings';
import type {DayTimelineEntry, DetectedTrip} from '@/lib/trip-detection';

type UsePlaceLookupSchedulerArgs = {
  entries: DayTimelineEntry[];
  selectedStay: DetectedTrip | null;
  selectedDateKey: string;
  savedPlaces: SavedPlaceRow[];
  tripConfig: TripDetectionConfig;
  viewingToday: boolean;
  historyPanelOpen: boolean;
};

function listQualifyingStays(
  entries: DayTimelineEntry[],
  savedPlaces: SavedPlaceRow[],
  config: TripDetectionConfig,
): DetectedTrip[] {
  return entries.filter(
    (entry): entry is DetectedTrip =>
      entry.kind === 'stay' &&
      stayQualifiesForPlaceLookup(entry, config) &&
      !shouldSkipPlaceLookupForStay(entry, savedPlaces),
  );
}

export function usePlaceLookupScheduler({
  entries,
  selectedStay,
  selectedDateKey,
  savedPlaces,
  tripConfig,
  viewingToday,
  historyPanelOpen,
}: UsePlaceLookupSchedulerArgs): void {
  const appState = useRef(AppState.currentState);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextState => {
      if (appState.current.match(/inactive|background/) && nextState === 'active') {
        resetPlaceLookupSessionBudget();
      }
      appState.current = nextState;
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    resetPlaceLookupSessionBudget();
  }, [viewingToday, historyPanelOpen]);

  useEffect(() => {
    let cancelled = false;

    runWhenIdle(() => {
      if (cancelled) {
        return;
      }

      void (async () => {
        if (viewingToday) {
          const todayStays = listQualifyingStays(entries, savedPlaces, tripConfig);
          await enqueuePlaceLookupsForStays(todayStays, savedPlaces, tripConfig);
          return;
        }

        if (
          historyPanelOpen &&
          selectedStay &&
          stayQualifiesForPlaceLookup(selectedStay, tripConfig) &&
          !shouldSkipPlaceLookupForStay(selectedStay, savedPlaces)
        ) {
          await ensureTripForClosedStay(selectedStay, selectedDateKey);
          await enqueuePlaceLookupForStay(selectedStay, savedPlaces, tripConfig);
        }
      })();
    });

    return () => {
      cancelled = true;
    };
  }, [
    entries,
    historyPanelOpen,
    savedPlaces,
    selectedDateKey,
    selectedStay,
    tripConfig,
    viewingToday,
  ]);
}
