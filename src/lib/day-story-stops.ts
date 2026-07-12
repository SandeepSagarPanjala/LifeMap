import type { SavedPlaceRow } from '@/db/repositories/saved-places';
import { distanceKm } from '@/lib/location-geo';
import { visitDisplayLabel } from '@/lib/place-lookup-types';
import { savedPlaceDisplayLabel } from '@/lib/saved-places';
import {
  stayMapCentroid,
  type DetectedTrip,
} from '@/lib/trip-detection';

export type DayStoryStop = {
  key: string;
  /** 1-based chronological visit numbers at this place. */
  visitNumbers: number[];
  stayIds: string[];
  stays: DetectedTrip[];
  coordinate: { latitude: number; longitude: number };
  label: string;
  isHome: boolean;
  savedPlaceId: number | null;
  poiId: number | null;
  poiCategory: string | null;
};

function stayGroupKey(
  stay: DetectedTrip,
  savedPlacesById: Map<number, SavedPlaceRow>,
): string | null {
  if (stay.placeKind === 'saved' && stay.placeId != null) {
    return `saved:${stay.placeId}`;
  }
  if (stay.poiId != null) {
    return `poi:${stay.poiId}`;
  }
  const saved =
    stay.placeId != null ? savedPlacesById.get(stay.placeId) : undefined;
  if (saved) {
    return `saved:${saved.id}`;
  }
  return null;
}

function stayLabel(
  stay: DetectedTrip,
  savedPlacesById: Map<number, SavedPlaceRow>,
): string {
  if (stay.placeKind === 'saved' && stay.placeId != null) {
    const saved = savedPlacesById.get(stay.placeId);
    if (saved) {
      return savedPlaceDisplayLabel(saved);
    }
  }
  const fromFields = visitDisplayLabel({
    placeKind: stay.placeKind,
    placeLabel: stay.placeLabel,
    poiLabel: stay.poiLabel,
  });
  if (fromFields) {
    return fromFields;
  }
  return 'Stop';
}

/**
 * Chronological stay stops for day-story map browse (History closed).
 * Groups revisits by saved place / POI / proximity so Home can show `1 · 4 · 7`.
 */
export function buildDayStoryStops(
  stays: readonly DetectedTrip[],
  savedPlaces: readonly SavedPlaceRow[] = [],
  groupRadiusMeters = 150,
): DayStoryStop[] {
  const stayOnly = stays
    .filter(stay => stay.kind === 'stay')
    .slice()
    .sort((a, b) => a.startAt.getTime() - b.startAt.getTime());

  if (stayOnly.length === 0) {
    return [];
  }

  const savedPlacesById = new Map(savedPlaces.map(place => [place.id, place]));
  const groups: DayStoryStop[] = [];
  const keyToIndex = new Map<string, number>();

  stayOnly.forEach((stay, index) => {
    const visitNumber = index + 1;
    const centroid = stayMapCentroid(stay);
    const explicitKey = stayGroupKey(stay, savedPlacesById);

    let groupIndex =
      explicitKey != null ? keyToIndex.get(explicitKey) : undefined;

    if (groupIndex == null) {
      groupIndex = groups.findIndex(group => {
        if (explicitKey != null && group.key === explicitKey) {
          return true;
        }
        if (explicitKey == null && group.savedPlaceId == null && group.poiId == null) {
          const distM =
            distanceKm(
              { lat: centroid.latitude, lng: centroid.longitude },
              {
                lat: group.coordinate.latitude,
                lng: group.coordinate.longitude,
              },
            ) * 1000;
          return distM <= groupRadiusMeters;
        }
        if (explicitKey == null && group.savedPlaceId != null) {
          const distM =
            distanceKm(
              { lat: centroid.latitude, lng: centroid.longitude },
              {
                lat: group.coordinate.latitude,
                lng: group.coordinate.longitude,
              },
            ) * 1000;
          return distM <= groupRadiusMeters;
        }
        return false;
      });
    }

    if (groupIndex == null || groupIndex < 0) {
      const saved =
        stay.placeKind === 'saved' && stay.placeId != null
          ? savedPlacesById.get(stay.placeId)
          : undefined;
      const key = explicitKey ?? `geo:${stay.id}`;
      const stop: DayStoryStop = {
        key,
        visitNumbers: [visitNumber],
        stayIds: [stay.id],
        stays: [stay],
        // Always use GPS stay location so Home isn't snapped to a stale saved pin.
        coordinate: centroid,
        label: stayLabel(stay, savedPlacesById),
        isHome: saved?.kind === 'home',
        savedPlaceId: saved?.id ?? null,
        poiId: stay.poiId ?? null,
        poiCategory: stay.poiCategory ?? null,
      };
      keyToIndex.set(key, groups.length);
      groups.push(stop);
      return;
    }

    const group = groups[groupIndex]!;
    group.visitNumbers.push(visitNumber);
    group.stayIds.push(stay.id);
    group.stays.push(stay);
    // Keep the pin on the average of visit GPS centroids.
    let latSum = 0;
    let lngSum = 0;
    for (const groupedStay of group.stays) {
      const c = stayMapCentroid(groupedStay);
      latSum += c.latitude;
      lngSum += c.longitude;
    }
    group.coordinate = {
      latitude: latSum / group.stays.length,
      longitude: lngSum / group.stays.length,
    };
    if (!group.poiCategory && stay.poiCategory) {
      group.poiCategory = stay.poiCategory;
    }
    if (!group.poiId && stay.poiId != null) {
      group.poiId = stay.poiId;
    }
    if (group.label === 'Stop') {
      group.label = stayLabel(stay, savedPlacesById);
    } else if (
      stay.placeKind === 'saved' ||
      (stay.poiLabel && group.poiId == null)
    ) {
      const nextLabel = stayLabel(stay, savedPlacesById);
      if (nextLabel !== 'Stop') {
        group.label = nextLabel;
      }
    }
  });

  return groups;
}

export function formatDayStoryVisitNumbers(numbers: readonly number[]): string {
  return numbers.join(' · ');
}

/** 1-based visit number for each stay id (chronological). */
export function chronologicalStayVisitNumbers(
  stays: readonly DetectedTrip[],
): Map<string, number> {
  const sorted = stays
    .filter(stay => stay.kind === 'stay')
    .slice()
    .sort((a, b) => a.startAt.getTime() - b.startAt.getTime());
  const map = new Map<string, number>();
  sorted.forEach((stay, index) => {
    map.set(stay.id, index + 1);
  });
  return map;
}

/**
 * Visit number of the stay this drive leaves from (origin).
 * Used to tint the drive the same color as that stop's badge
 * (e.g. drive 1→2 uses visit 1's color).
 */
export function originVisitNumberForTravel(
  entries: readonly import('@/lib/trip-detection').DayTimelineEntry[],
  travelId: string,
  visitByStayId: ReadonlyMap<string, number>,
): number | null {
  const travelIndex = entries.findIndex(entry => entry.id === travelId);
  if (travelIndex < 0) {
    return null;
  }
  for (let i = travelIndex - 1; i >= 0; i -= 1) {
    const entry = entries[i]!;
    if (entry.kind === 'stay') {
      return visitByStayId.get(entry.id) ?? null;
    }
    if (entry.kind === 'travel') {
      return null;
    }
  }
  return null;
}

/** True when a moment pin sits on a day-story stop (callout already owns it). */
export function isCoordinateOnDayStoryStop(
  coordinate: { latitude: number; longitude: number },
  stops: readonly DayStoryStop[],
  radiusMeters: number,
): boolean {
  return stops.some(stop => {
    const distM =
      distanceKm(
        { lat: coordinate.latitude, lng: coordinate.longitude },
        {
          lat: stop.coordinate.latitude,
          lng: stop.coordinate.longitude,
        },
      ) * 1000;
    return distM <= radiusMeters;
  });
}
