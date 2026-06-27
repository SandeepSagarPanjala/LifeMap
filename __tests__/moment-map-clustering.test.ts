import type {MomentMapPin} from '@/components/map/MomentMapOverlay';
import type {SavedPlaceRow} from '@/db/repositories/saved-places';
import type {MomentRow} from '@/db/repositories/moments';

import {
  partitionMomentMapPins,
  shouldClusterMomentsOnMap,
} from '../src/lib/moments/moment-map-clustering';

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
    moment: {
      id,
      type,
      timestamp: new Date(),
      finishedAt: null,
      lat: null,
      lng: null,
      contentPath: null,
      textBody: null,
      caption: null,
      title: null,
      moodScore: null,
      moodLabel: null,
      placeLabel: null,
      linkedPointId: null,
      contentBytes: null,
      sourceBytes: null,
      contentFormat: null,
      shareVisibility: 'private',
      contentSyncState: 'local_only',
      voiceAttachmentPath: null,
      voiceAttachmentBytes: null,
      voiceDurationSec: null,
      photoAttachmentsJson: null,
      activityId: null,
      activityEmoji: null,
      activityLabel: null,
    },
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
