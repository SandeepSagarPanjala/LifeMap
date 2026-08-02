import type { MomentMapPin } from '@/components/map/MomentMapOverlay';
import type { SavedPlaceRow } from '@/db/repositories/saved-places';
import type { MomentRow } from '@/db/repositories/moments';
import {
  coalesceMomentMapPins,
  emphasizeTravelMomentMapPins,
  omitMomentMapPinsAlreadyOnDayStoryStops,
  partitionMomentMapPins,
  shouldClusterMomentsOnMap,
} from '../src/lib/moments/moment-map-clustering';
import { makeMoment } from './helpers/fixtures';

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
    moment: makeMoment({ id, type, timestamp: new Date() }),
    coordinate: { latitude: lat, longitude: lng },
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

describe('omitMomentMapPinsAlreadyOnDayStoryStops', () => {
  it('keeps travel moments near a stay that are not on the stay chip set', () => {
    const stayChipMoment = momentPin(10, 33.101, -96.696, 'activity');
    const travelAtDeparture = momentPin(205, 33.101, -96.696, 'activity');
    const elsewhere = momentPin(11, 33.2, -96.7, 'photo');

    const result = omitMomentMapPinsAlreadyOnDayStoryStops(
      [stayChipMoment, travelAtDeparture, elsewhere],
      new Set([10]),
    );

    expect(result.map(pin => pin.moment.id)).toEqual([205, 11]);
  });

  it('strips only already-shown moments from a coalesced pin', () => {
    const pin: MomentMapPin = {
      moment: makeMoment({
        id: 10,
        type: 'activity',
        timestamp: new Date('2026-07-31T20:53:00'),
      }),
      coordinate: { latitude: 33.101, longitude: -96.696 },
      groupedMoments: [
        makeMoment({
          id: 205,
          type: 'activity',
          timestamp: new Date('2026-07-31T22:05:00'),
        }),
      ],
    };

    const result = omitMomentMapPinsAlreadyOnDayStoryStops([pin], new Set([10]));
    expect(result).toHaveLength(1);
    expect(result[0]?.moment.id).toBe(205);
    expect(result[0]?.groupedMoments).toBeUndefined();
  });
});

describe('emphasizeTravelMomentMapPins', () => {
  it('tags leftover pins as travel without moving coordinates', () => {
    const pin: MomentMapPin = {
      moment: makeMoment({
        id: 205,
        type: 'activity',
        timestamp: new Date('2026-08-01T03:05:18.000Z'),
      }),
      coordinate: { latitude: 33.101, longitude: -96.696 },
    };

    const result = emphasizeTravelMomentMapPins([pin]);
    expect(result).toHaveLength(1);
    expect(result[0]?.emphasis).toBe('travel');
    expect(result[0]?.coordinate).toEqual({
      latitude: 33.101,
      longitude: -96.696,
    });
  });
});
