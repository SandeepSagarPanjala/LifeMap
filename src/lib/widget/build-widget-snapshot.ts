import { listSavedPlaces } from '@/db/repositories/saved-places';
import { toDateKey } from '@/lib/day-utils';
import { formatMapDateLabel } from '@/lib/history-timeline';
import { loadHistoryForDayCoalesced } from '@/lib/history-day-load';
import { getCurrentOpenActivity } from '@/lib/today-history';
import {
  formatHereForDuration,
  formatTripDuration,
  isVisitOngoing,
} from '@/lib/trip-format';
import { getCurrentTripDetectionConfig } from '@/lib/trip-detection-config';
import { loadVisitPlaceDisplayForStay } from '@/lib/visit-place-label';
import {
  matchSavedPlaceForStay,
  savedPlaceDisplayLabel,
} from '@/lib/saved-places';

import type { WidgetPlaceKind, WidgetSnapshot } from './types';

function placeKindFromSaved(
  savedKind: 'home' | 'work' | 'favorite',
): WidgetPlaceKind {
  return savedKind;
}

function resolvePlaceLabel(
  savedPlace: ReturnType<typeof matchSavedPlaceForStay>,
  visitLabel: string | null,
): { placeLabel: string; placeKind: WidgetPlaceKind } {
  if (savedPlace) {
    return {
      placeLabel: savedPlaceDisplayLabel(savedPlace),
      placeKind: placeKindFromSaved(savedPlace.kind),
    };
  }

  const trimmed = visitLabel?.trim();
  if (trimmed) {
    return { placeLabel: trimmed, placeKind: 'nearby' };
  }

  return { placeLabel: 'Nearby', placeKind: 'nearby' };
}

export async function buildWidgetSnapshot(
  now: Date = new Date(),
): Promise<WidgetSnapshot> {
  const todayKey = toDateKey(now);
  const detectionConfig = getCurrentTripDetectionConfig();
  const [history, savedPlaces] = await Promise.all([
    loadHistoryForDayCoalesced(todayKey, detectionConfig),
    listSavedPlaces(),
  ]);

  const lastPoint = history.points[history.points.length - 1];
  const userCoordinate =
    lastPoint != null
      ? { latitude: lastPoint.lat, longitude: lastPoint.lng }
      : null;

  const openActivity = getCurrentOpenActivity(history.entries, {
    userCoordinate,
    config: detectionConfig,
  });

  const dateLabel = formatMapDateLabel(todayKey, todayKey, now);

  if (openActivity == null) {
    return {
      updatedAt: now.toISOString(),
      placeLabel: 'On the move',
      placeKind: 'none',
      durationLabel: null,
      dateLabel,
      isOngoing: false,
    };
  }

  if (openActivity.kind === 'travel') {
    const durationMs = Math.max(
      0,
      now.getTime() - openActivity.startAt.getTime(),
    );
    return {
      updatedAt: now.toISOString(),
      placeLabel: 'Driving',
      placeKind: 'none',
      durationLabel: formatTripDuration(durationMs),
      dateLabel,
      isOngoing: true,
    };
  }

  const openVisit = openActivity;

  const savedPlace = matchSavedPlaceForStay(openVisit, savedPlaces);
  const visitDisplay = savedPlace
    ? null
    : await loadVisitPlaceDisplayForStay(openVisit, savedPlaces);
  const { placeLabel, placeKind } = resolvePlaceLabel(
    savedPlace,
    visitDisplay?.primaryLabel ?? null,
  );

  const ongoing = isVisitOngoing(openVisit.endAt, now, {
    openThroughNow: openVisit.openThroughNow,
  });
  const durationMs = ongoing
    ? Math.max(0, now.getTime() - openVisit.startAt.getTime())
    : openVisit.durationMs;

  return {
    updatedAt: now.toISOString(),
    placeLabel,
    placeKind,
    durationLabel: ongoing ? formatHereForDuration(durationMs) : null,
    dateLabel,
    isOngoing: ongoing,
  };
}
