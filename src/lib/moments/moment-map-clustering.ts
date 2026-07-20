import type { SavedPlaceRow } from '@/db/repositories/saved-places';
import type { MomentMapPin } from '@/components/map/MomentMapOverlay';
import { matchSavedPlaceForPoint } from '@/lib/saved-places';

import {
  addToCounts,
  emptyMomentCounts,
  hasMomentCounts,
  type MomentCounts,
} from './moment-counts';

/** Cluster moment pins when map span is wider than this (~800 m). */
export const MOMENT_CLUSTER_MIN_ZOOM_DELTA = 0.008;

export function shouldClusterMomentsOnMap(latitudeDelta: number): boolean {
  return latitudeDelta > MOMENT_CLUSTER_MIN_ZOOM_DELTA;
}

export type SavedPlaceMomentCluster = {
  place: SavedPlaceRow;
  counts: MomentCounts;
  momentIds: number[];
};

export type PartitionedMomentMapPins = {
  savedPlaceClusters: SavedPlaceMomentCluster[];
  individualPins: MomentMapPin[];
};

function momentIdsForPin(pin: MomentMapPin): number[] {
  return [
    pin.moment.id,
    ...(pin.groupedMoments?.map(moment => moment.id) ?? []),
  ];
}

function coordinateBucket(lat: number, lng: number): string {
  return `${lat.toFixed(4)}:${lng.toFixed(4)}`;
}

/** Merge day-journey pins that land on the same map bucket. */
export function coalesceMomentMapPins(pins: MomentMapPin[]): MomentMapPin[] {
  const grouped = new Map<string, MomentMapPin[]>();
  for (const pin of pins) {
    const bucket = coordinateBucket(
      pin.coordinate.latitude,
      pin.coordinate.longitude,
    );
    const existing = grouped.get(bucket);
    if (existing != null) {
      existing.push(pin);
    } else {
      grouped.set(bucket, [pin]);
    }
  }

  return [...grouped.values()].map(bucketPins => {
    if (bucketPins.length === 1) {
      return bucketPins[0]!;
    }

    const moments = bucketPins
      .flatMap(pin => [pin.moment, ...(pin.groupedMoments ?? [])])
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    const [first, ...rest] = moments;
    return {
      moment: first!,
      coordinate: bucketPins[0]!.coordinate,
      groupedMoments: rest.length > 0 ? rest : undefined,
    };
  });
}

export function partitionMomentMapPins(
  pins: MomentMapPin[],
  places: readonly SavedPlaceRow[],
  clusterWhenZoomedOut: boolean,
): PartitionedMomentMapPins {
  if (!clusterWhenZoomedOut || pins.length === 0 || places.length === 0) {
    return { savedPlaceClusters: [], individualPins: pins };
  }

  const clusteredIds = new Set<number>();
  const savedPlaceClusters: SavedPlaceMomentCluster[] = [];

  // Match each pin to its saved place exactly once and bucket by place id.
  // Previously each place re-scanned every pin and each pin re-scanned every
  // place inside `matchSavedPlaceForPoint`, giving O(places^2 * pins). Pin
  // ordering within a bucket is preserved (pins iterated in order).
  const pinsByPlaceId = new Map<SavedPlaceRow['id'], MomentMapPin[]>();
  for (const pin of pins) {
    const match = matchSavedPlaceForPoint(
      { lat: pin.coordinate.latitude, lng: pin.coordinate.longitude },
      places,
    );
    if (match == null) {
      continue;
    }
    const bucket = pinsByPlaceId.get(match.id);
    if (bucket != null) {
      bucket.push(pin);
    } else {
      pinsByPlaceId.set(match.id, [pin]);
    }
  }

  for (const place of places) {
    const atPlace = pinsByPlaceId.get(place.id);

    if (atPlace == null || atPlace.length === 0) {
      continue;
    }

    const counts = emptyMomentCounts();
    const momentIds: number[] = [];
    for (const pin of atPlace) {
      for (const momentId of momentIdsForPin(pin)) {
        momentIds.push(momentId);
        clusteredIds.add(momentId);
      }
      addToCounts(counts, pin.moment);
      for (const grouped of pin.groupedMoments ?? []) {
        addToCounts(counts, grouped);
      }
    }

    if (hasMomentCounts(counts)) {
      savedPlaceClusters.push({ place, counts, momentIds });
    }
  }

  return {
    savedPlaceClusters,
    individualPins: pins.filter(
      pin => !momentIdsForPin(pin).some(id => clusteredIds.has(id)),
    ),
  };
}
