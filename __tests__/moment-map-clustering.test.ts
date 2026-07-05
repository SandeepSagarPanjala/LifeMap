import type {MomentMapPin} from '@/components/map/MomentMapOverlay';
import type {SavedPlaceRow} from '@/db/repositories/saved-places';
import type {MomentRow} from '@/db/repositories/moments';
import {
  coalesceMomentMapPins,
  partitionMomentMapPins,
  shouldClusterMomentsOnMap,
} from '../src/lib/moments/moment-map-clustering';
import {makeMoment} from './helpers/fixtures';

const home: SavedPlaceRow = {
  id: 1,
  kind: 'home',
  label: 'Home',
  lat: 33.25,
  lng: -97.153,
  radiusMeters: 150,
  addressLine: null,
  active: true,
  createdAt: new Date(),
};

function momentPin(
  id: number,
  lat: number,
  lng: number,
  type: MomentRow['type'] = 'photo',
): MomentMapPin {
  return {
    moment: makeMoment({id, type, timestamp: new Date()}),
    coordinate: {latitude: lat, longitude: lng},
  };
}

describe('shouldClusterMomentsOnMap', () => {
  it('clusters when zoomed out', () => {
    expect(shouldClusterMomentsOnMap(0.05)).toBe(true);
  });

  it('shows individual pins when zoomed in', () => {
    expect(shouldClusterMomentsOnMap(0.004)).toBe(false);
  });
});

describe('partitionMomentMapPins', () => {
  it('returns all pins individually when clustering is off', () => {
    const pins = [
      momentPin(1, 33.25, -97.153),
      momentPin(2, 33.2501, -97.1531),
    ];
    const result = partitionMomentMapPins(pins, [home], false);
    expect(result.savedPlaceClusters).toHaveLength(0);
    expect(result.individualPins).toHaveLength(2);
  });

  it('groups moments at a saved place when zoomed out', () => {
    const pins = [
      momentPin(1, 33.25, -97.153),
      momentPin(2, 33.2502, -97.1529),
      momentPin(3, 33.29, -97.05),
    ];
    const result = partitionMomentMapPins(pins, [home], true);
    expect(result.savedPlaceClusters).toHaveLength(1);
    expect(result.savedPlaceClusters[0]?.place.id).toBe(1);
    expect(result.savedPlaceClusters[0]?.counts.photo).toBe(2);
    expect(result.savedPlaceClusters[0]?.momentIds).toEqual([1, 2]);
    expect(result.individualPins).toHaveLength(1);
    expect(result.individualPins[0]?.moment.id).toBe(3);
  });
});

describe('coalesceMomentMapPins', () => {
  it('merges pins in the same coordinate bucket', () => {
    const pins = [
      momentPin(1, 33.2149, -97.1366),
      momentPin(2, 33.21491, -97.13661),
      momentPin(3, 33.29, -97.05),
    ];
    const result = coalesceMomentMapPins(pins);
    expect(result).toHaveLength(2);
    const merged = result.find(pin => pin.moment.id === 1);
    expect(merged?.groupedMoments?.map(row => row.id)).toEqual([2]);
  });
});
