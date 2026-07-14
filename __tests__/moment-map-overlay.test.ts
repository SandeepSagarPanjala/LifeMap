import {
  buildHistoryMomentMapPins,
  buildMomentMapPins,
} from '../src/components/map/MomentMapOverlay';
import { makeMoment } from './helpers/fixtures';
import type { DayTimelineEntry } from '@/lib/trip-detection';

describe('buildMomentMapPins', () => {
  it('places photo moments on the GPS trail at capture time', () => {
    const pins = buildMomentMapPins(
      [
        makeMoment({
          id: 1,
          type: 'photo',
          timestamp: new Date('2026-06-08T15:00:00.000Z'),
          contentPath: '/tmp/photo.jpg',
          contentBytes: 100,
          sourceBytes: 1000,
          contentFormat: 'jpeg',
        }),
      ],
      [
        {
          id: 10,
          timestamp: new Date('2026-06-08T14:00:00.000Z'),
          lat: 33,
          lng: -97,
          accuracy: null,
          altitude: null,
          speed: null,
          source: 'gps',
          heading: null,
          headingAccuracy: null,
          speedAccuracy: null,
          altitudeAccuracy: null,
          activityType: null,
          activityConfidence: null,
          isMoving: null,
          isMock: null,
          uuid: null,
          batteryLevel: null,
          batteryIsCharging: null,
        },
        {
          id: 11,
          timestamp: new Date('2026-06-08T16:00:00.000Z'),
          lat: 34,
          lng: -96,
          accuracy: null,
          altitude: null,
          speed: null,
          source: 'gps',
          heading: null,
          headingAccuracy: null,
          speedAccuracy: null,
          altitudeAccuracy: null,
          activityType: null,
          activityConfidence: null,
          isMoving: null,
          isMock: null,
          uuid: null,
          batteryLevel: null,
          batteryIsCharging: null,
        },
      ],
      [],
    );

    expect(pins).toHaveLength(1);
    expect(pins[0]?.coordinate).toEqual({ latitude: 33.5, longitude: -96.5 });
  });

  it('uses materialized route anchors when available', () => {
    const entry: DayTimelineEntry = {
      id: 'materialized-5',
      kind: 'stay',
      points: [],
      startAt: new Date('2026-06-08T14:00:00.000Z'),
      endAt: new Date('2026-06-08T16:00:00.000Z'),
      durationMs: 7_200_000,
      distanceKm: 0,
      materializedTripId: 5,
      momentRefs: [{ momentId: 1, momentKind: 'photo' }],
      routeMomentAnchors: [{ momentId: 1, lat: 33.21, lng: -97.14 }],
    };
    const pins = buildMomentMapPins(
      [
        makeMoment({
          id: 1,
          type: 'photo',
          timestamp: new Date('2026-06-08T15:00:00.000Z'),
        }),
      ],
      [],
      [entry],
    );

    expect(pins).toHaveLength(1);
    expect(pins[0]?.coordinate).toEqual({ latitude: 33.21, longitude: -97.14 });
  });
});

describe('buildHistoryMomentMapPins', () => {
  it('returns no pins for materialized stays', () => {
    const entry: DayTimelineEntry = {
      id: 'materialized-5',
      kind: 'stay',
      points: [],
      startAt: new Date('2026-06-08T14:00:00.000Z'),
      endAt: new Date('2026-06-08T16:00:00.000Z'),
      durationMs: 7_200_000,
      distanceKm: 0,
      materializedTripId: 5,
      momentRefs: [{ momentId: 1, momentKind: 'photo' }],
      routeMomentAnchors: [{ momentId: 1, lat: 33.21, lng: -97.14 }],
    };
    const pins = buildHistoryMomentMapPins(
      entry,
      [
        makeMoment({
          id: 1,
          type: 'photo',
          timestamp: new Date('2026-06-08T15:00:00.000Z'),
        }),
      ],
      [],
    );
    expect(pins).toEqual([]);
  });
});
