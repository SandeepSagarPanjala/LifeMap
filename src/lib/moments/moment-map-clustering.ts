import type {SavedPlaceRow} from '@/db/repositories/saved-places';
import type {MomentMapPin} from '@/components/map/MomentMapOverlay';
import {matchSavedPlaceForPoint} from '@/lib/saved-places';

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

export function partitionMomentMapPins(
  pins: MomentMapPin[],
  places: readonly SavedPlaceRow[],
  clusterWhenZoomedOut: boolean,
): PartitionedMomentMapPins {
  if (!clusterWhenZoomedOut || pins.length === 0 || places.length === 0) {
    return {savedPlaceClusters: [], individualPins: pins};
  }

  const clusteredIds = new Set<number>();
  const savedPlaceClusters: SavedPlaceMomentCluster[] = [];

  for (const place of places) {
    const atPlace = pins.filter(pin => {
      const match = matchSavedPlaceForPoint(
        {lat: pin.coordinate.latitude, lng: pin.coordinate.longitude},
        places,
      );
      return match?.id === place.id;
    });

    if (atPlace.length === 0) {
      continue;
    }

    const counts = emptyMomentCounts();
    const momentIds: number[] = [];
    for (const pin of atPlace) {
      addToCounts(counts, pin.moment);
      momentIds.push(pin.moment.id);
      clusteredIds.add(pin.moment.id);
    }

    if (hasMomentCounts(counts)) {
      savedPlaceClusters.push({place, counts, momentIds});
    }
  }

  return {
    savedPlaceClusters,
    individualPins: pins.filter(pin => !clusteredIds.has(pin.moment.id)),
  };
}
