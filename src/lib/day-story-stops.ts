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

function stayGroupKey(stay: DetectedTrip): string | null {
  if (stay.placeKind === 'saved' && stay.placeId != null) {
    return `saved:${stay.placeId}`;
  }
  if (stay.poiId != null) {
    return `poi:${stay.poiId}`;
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
  // Running centroid sums per group so a revisit merge stays O(1) instead of
  // recomputing `stayMapCentroid` for every stay already in the group (which
  // made a heavily-revisited place, e.g. Home, O(visits^2)).
  const centroidLatSums: number[] = [];
  const centroidLngSums: number[] = [];

  stayOnly.forEach((stay, index) => {
    const visitNumber = index + 1;
    const centroid = stayMapCentroid(stay);
    const explicitKey = stayGroupKey(stay);

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
      centroidLatSums.push(centroid.latitude);
      centroidLngSums.push(centroid.longitude);
      groups.push(stop);
      return;
    }

    const group = groups[groupIndex]!;
    group.visitNumbers.push(visitNumber);
    group.stayIds.push(stay.id);
    group.stays.push(stay);
    // Keep the pin on the average of visit GPS centroids (running mean).
    centroidLatSums[groupIndex] += centroid.latitude;
    centroidLngSums[groupIndex] += centroid.longitude;
    group.coordinate = {
      latitude: centroidLatSums[groupIndex]! / group.stays.length,
      longitude: centroidLngSums[groupIndex]! / group.stays.length,
    };
    // Prefer a concrete POI pick (History / override) over the first closest-POI name.
    if (stay.poiId != null) {
      group.poiId = stay.poiId;
      // Keep category in sync with the chosen POI (not only the first fill).
      group.poiCategory = stay.poiCategory ?? group.poiCategory;
      const nextLabel = stayLabel(stay, savedPlacesById);
      if (nextLabel !== 'Stop') {
        group.label = nextLabel;
      }
    } else {
      if (!group.poiCategory && stay.poiCategory) {
        group.poiCategory = stay.poiCategory;
      }
      if (group.label === 'Stop') {
        group.label = stayLabel(stay, savedPlacesById);
      } else if (stay.placeKind === 'saved') {
        const nextLabel = stayLabel(stay, savedPlacesById);
        if (nextLabel !== 'Stop') {
          group.label = nextLabel;
        }
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
