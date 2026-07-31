import {
  buildTravelMomentMarkers,
  countMoments,
  countMomentsForEntry,
  countMomentsForStayEntry,
  emptyMomentCounts,
  filterMomentsForEntry,
  filterMomentsForStayEntry,
  latestMomentCountPreviews,
  countMomentCountChips,
  shouldHideSavedPlaceMomentCluster,
  latestMomentIndexOfType,
} from '../src/lib/moments/moment-counts';
import type { MomentRow } from '../src/db/repositories/moments';
import type { SavedPlaceRow } from '../src/db/repositories/saved-places';
import type { DayTimelineEntry } from '../src/lib/trip-detection';
import { makeLocationPoint, makeMoment } from './helpers/fixtures';

function moment(
  partial: Partial<MomentRow> & Pick<MomentRow, 'id' | 'type' | 'timestamp'>,
): MomentRow {
  return makeMoment(partial);
}

describe('moment counts', () => {
  const now = new Date('2026-06-08T16:00:00.000Z');

  const stay: DayTimelineEntry = {
    id: 'stay-1',
    kind: 'stay',
    points: [],
    startAt: new Date('2026-06-08T13:00:00.000Z'),
    endAt: new Date('2026-06-08T16:00:00.000Z'),
    distanceKm: 0,
    durationMs: 3 * 60 * 60_000,
    openThroughNow: true,
  };

  const travel: DayTimelineEntry = {
    id: 'travel-1',
    kind: 'travel',
    points: [],
    startAt: new Date('2026-06-08T11:00:00.000Z'),
    endAt: new Date('2026-06-08T12:00:00.000Z'),
    distanceKm: 5,
    durationMs: 60 * 60_000,
  };

  it('counts all moment types for a day', () => {
    expect(
      countMoments([
        moment({
          id: 1,
          type: 'photo',
          timestamp: new Date('2026-06-08T14:00:00.000Z'),
        }),
        moment({
          id: 2,
          type: 'voice',
          timestamp: new Date('2026-06-08T14:30:00.000Z'),
        }),
        moment({
          id: 3,
          type: 'note',
          timestamp: new Date('2026-06-08T15:00:00.000Z'),
        }),
        moment({
          id: 4,
          type: 'photo',
          timestamp: new Date('2026-06-08T15:30:00.000Z'),
        }),
      ]),
    ).toEqual({ photo: 2, video: 0, voice: 1, note: 1, activity: 0, mood: 0 });
  });

  it('counts moments inside a visit entry', () => {
    const counts = countMomentsForEntry(
      [
        moment({
          id: 1,
          type: 'photo',
          timestamp: new Date('2026-06-08T14:00:00.000Z'),
        }),
        moment({
          id: 2,
          type: 'voice',
          timestamp: new Date('2026-06-08T11:30:00.000Z'),
        }),
      ],
      stay,
      now,
    );
    expect(counts).toEqual({
      photo: 1,
      video: 0,
      voice: 0,
      note: 0,
      activity: 0, mood: 0,
    });
  });

  it('builds travel markers at interpolated GPS points', () => {
    const markers = buildTravelMomentMarkers(
      [
        moment({
          id: 1,
          type: 'photo',
          timestamp: new Date('2026-06-08T11:30:00.000Z'),
        }),
      ],
      [travel, stay],
      [
        {
          id: 10,
          timestamp: new Date('2026-06-08T11:00:00.000Z'),
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
          timestamp: new Date('2026-06-08T12:00:00.000Z'),
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
      now,
    );

    expect(markers).toHaveLength(1);
    expect(markers[0]?.counts).toEqual({ ...emptyMomentCounts(), photo: 1 });
    expect(markers[0]?.momentIds).toEqual([1]);
    expect(markers[0]?.coordinate).toEqual({
      latitude: 33.5,
      longitude: -96.5,
    });
  });

  it('filters moments for a timeline entry', () => {
    const moments = [
      moment({
        id: 1,
        type: 'photo',
        timestamp: new Date('2026-06-08T14:00:00.000Z'),
      }),
      moment({
        id: 2,
        type: 'voice',
        timestamp: new Date('2026-06-08T10:00:00.000Z'),
      }),
      moment({
        id: 3,
        type: 'note',
        timestamp: new Date('2026-06-08T15:00:00.000Z'),
      }),
    ];

    expect(
      filterMomentsForEntry(moments, stay, now).map(item => item.id),
    ).toEqual([1, 3]);
  });

  it('hides the saved-place cluster when the stay callout already shows moments', () => {
    const counts = { photo: 3, video: 0, voice: 1, note: 1, activity: 0, mood: 0 };
    expect(shouldHideSavedPlaceMomentCluster(7, 7, counts)).toBe(true);
    expect(shouldHideSavedPlaceMomentCluster(7, 8, counts)).toBe(false);
    expect(shouldHideSavedPlaceMomentCluster(7, 7, emptyMomentCounts())).toBe(
      false,
    );
  });

  it('clubs all moments at a saved place across multiple visits', () => {
    const home: SavedPlaceRow = {
      id: 1,
      kind: 'home',
      label: 'Home',
      lat: 33.1,
      lng: -97.1,
      radiusMeters: 120,
      addressLine: null,
      active: true,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    };

    const afternoonStay: DayTimelineEntry = {
      id: 'stay-afternoon',
      kind: 'stay',
      points: [
        makeLocationPoint({
          id: 1,
          lat: 33.1,
          lng: -97.1,
          timestamp: new Date('2026-06-08T15:00:00.000Z'),
        }),
      ],
      startAt: new Date('2026-06-08T14:30:00.000Z'),
      endAt: new Date('2026-06-08T16:00:00.000Z'),
      distanceKm: 0,
      durationMs: 90 * 60_000,
    };

    const eveningStay: DayTimelineEntry = {
      id: 'stay-evening',
      kind: 'stay',
      points: [
        makeLocationPoint({
          id: 2,
          lat: 33.1005,
          lng: -97.1005,
          timestamp: new Date('2026-06-08T22:47:00.000Z'),
        }),
      ],
      startAt: new Date('2026-06-08T22:47:00.000Z'),
      endAt: new Date('2026-06-08T23:29:00.000Z'),
      distanceKm: 0,
      durationMs: 42 * 60_000,
      openThroughNow: true,
    };

    const trailPoints = [
      makeLocationPoint({
        id: 10,
        lat: 33.1,
        lng: -97.1,
        timestamp: new Date('2026-06-08T15:00:00.000Z'),
      }),
      makeLocationPoint({
        id: 11,
        lat: 33.1,
        lng: -97.1,
        timestamp: new Date('2026-06-08T15:10:00.000Z'),
      }),
      makeLocationPoint({
        id: 12,
        lat: 33.1,
        lng: -97.1,
        timestamp: new Date('2026-06-08T15:20:00.000Z'),
      }),
      makeLocationPoint({
        id: 13,
        lat: 34,
        lng: -96,
        timestamp: new Date('2026-06-08T11:30:00.000Z'),
      }),
    ];

    const moments = [
      moment({
        id: 1,
        type: 'photo',
        timestamp: new Date('2026-06-08T15:00:00.000Z'),
      }),
      moment({
        id: 2,
        type: 'voice',
        timestamp: new Date('2026-06-08T15:10:00.000Z'),
      }),
      moment({
        id: 3,
        type: 'note',
        timestamp: new Date('2026-06-08T15:20:00.000Z'),
      }),
      moment({
        id: 4,
        type: 'photo',
        timestamp: new Date('2026-06-08T11:30:00.000Z'),
      }),
    ];

    const stayOptions = {
      savedPlace: home,
      dwellRadiusMeters: 80,
      points: trailPoints,
      entries: [afternoonStay, eveningStay],
      aggregation: 'place' as const,
      now,
    };

    expect(countMomentsForEntry(moments, eveningStay, now)).toEqual({
      photo: 0,
      video: 0,
      voice: 0,
      note: 0,
      activity: 0, mood: 0,
    });
    expect(countMomentsForStayEntry(moments, eveningStay, stayOptions)).toEqual(
      {
        photo: 1,
        video: 0,
        voice: 1,
        note: 1,
        activity: 0, mood: 0,
      },
    );
    expect(
      filterMomentsForStayEntry(moments, eveningStay, stayOptions).map(
        item => item.id,
      ),
    ).toEqual([1, 2, 3]);
  });

  it('keeps history visit counts scoped to the selected time window', () => {
    const home: SavedPlaceRow = {
      id: 1,
      kind: 'home',
      label: 'Home',
      lat: 33.1,
      lng: -97.1,
      radiusMeters: 120,
      addressLine: null,
      active: true,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    };

    const afternoonStay: DayTimelineEntry = {
      id: 'stay-afternoon',
      kind: 'stay',
      points: [],
      startAt: new Date('2026-06-08T17:53:00.000Z'),
      endAt: new Date('2026-06-08T22:23:00.000Z'),
      distanceKm: 0,
      durationMs: 4.5 * 60 * 60_000,
    };

    const eveningStay: DayTimelineEntry = {
      id: 'stay-evening',
      kind: 'stay',
      points: [],
      startAt: new Date('2026-06-08T22:47:00.000Z'),
      endAt: new Date('2026-06-08T23:41:00.000Z'),
      distanceKm: 0,
      durationMs: 54 * 60_000,
    };

    const moments = [
      moment({
        id: 1,
        type: 'photo',
        timestamp: new Date('2026-06-08T18:00:00.000Z'),
      }),
      moment({
        id: 2,
        type: 'photo',
        timestamp: new Date('2026-06-08T19:00:00.000Z'),
      }),
      moment({
        id: 3,
        type: 'photo',
        timestamp: new Date('2026-06-08T20:00:00.000Z'),
      }),
      moment({
        id: 4,
        type: 'voice',
        timestamp: new Date('2026-06-08T20:30:00.000Z'),
      }),
      moment({
        id: 5,
        type: 'note',
        timestamp: new Date('2026-06-08T21:00:00.000Z'),
      }),
      moment({
        id: 6,
        type: 'photo',
        timestamp: new Date('2026-06-08T23:00:00.000Z'),
      }),
    ];

    const visitOptions = {
      savedPlace: home,
      dwellRadiusMeters: 80,
      points: [],
      entries: [afternoonStay, eveningStay],
      aggregation: 'visit' as const,
      now,
    };

    expect(
      countMomentsForStayEntry(moments, afternoonStay, visitOptions),
    ).toEqual({
      photo: 3,
      video: 0,
      voice: 1,
      note: 1,
      activity: 0, mood: 0,
    });
    expect(
      countMomentsForStayEntry(moments, eveningStay, visitOptions),
    ).toEqual({
      photo: 1,
      video: 0,
      voice: 0,
      note: 0,
      activity: 0, mood: 0,
    });
  });
});

describe('latestMomentIndexOfType', () => {
  it('returns the index of the latest moment matching the type', () => {
    const moments = [
      moment({
        id: 1,
        type: 'photo',
        timestamp: new Date('2026-06-21T08:00:00Z'),
      }),
      moment({
        id: 2,
        type: 'voice',
        timestamp: new Date('2026-06-21T09:00:00Z'),
      }),
      moment({
        id: 3,
        type: 'note',
        timestamp: new Date('2026-06-21T10:00:00Z'),
      }),
      moment({
        id: 4,
        type: 'photo',
        timestamp: new Date('2026-06-21T11:00:00Z'),
      }),
    ];

    expect(latestMomentIndexOfType(moments, 'photo')).toBe(3);
    expect(latestMomentIndexOfType(moments, 'note')).toBe(2);
    expect(latestMomentIndexOfType(moments, 'video')).toBe(-1);
  });

  it('uses timestamps rather than array position', () => {
    const moments = [
      moment({
        id: 1,
        type: 'mood',
        timestamp: new Date('2026-06-21T18:00:00Z'),
      }),
      moment({
        id: 2,
        type: 'mood',
        timestamp: new Date('2026-06-21T09:00:00Z'),
      }),
    ];

    expect(latestMomentIndexOfType(moments, 'mood')).toBe(0);
  });

  it('picks latest rich previews and ignores diary/voice', () => {
    const previews = latestMomentCountPreviews([
      moment({
        id: 1,
        type: 'photo',
        timestamp: new Date('2026-06-08T14:00:00.000Z'),
        thumbnailPath: 'moments/old-photo-thumb.jpg',
      }),
      moment({
        id: 2,
        type: 'photo',
        timestamp: new Date('2026-06-08T15:00:00.000Z'),
        thumbnailPath: 'moments/new-photo-thumb.jpg',
      }),
      moment({
        id: 3,
        type: 'video',
        timestamp: new Date('2026-06-08T14:30:00.000Z'),
        thumbnailPath: 'moments/video-thumb.jpg',
      }),
      moment({
        id: 4,
        type: 'activity',
        timestamp: new Date('2026-06-08T14:10:00.000Z'),
        activityEmoji: '☕',
      }),
      moment({
        id: 5,
        type: 'activity',
        timestamp: new Date('2026-06-08T15:10:00.000Z'),
        activityEmoji: '🏃',
      }),
      moment({
        id: 6,
        type: 'mood',
        timestamp: new Date('2026-06-08T14:20:00.000Z'),
        moodLabel: 'Calm',
        moodVariant: 'cat',
      }),
      moment({
        id: 7,
        type: 'mood',
        timestamp: new Date('2026-06-08T15:20:00.000Z'),
        moodLabel: 'Joyful',
        moodVariant: 'dog',
      }),
      moment({
        id: 8,
        type: 'note',
        timestamp: new Date('2026-06-08T15:30:00.000Z'),
      }),
      moment({
        id: 9,
        type: 'voice',
        timestamp: new Date('2026-06-08T15:40:00.000Z'),
      }),
    ]);

    expect(previews.photoThumbUri).toContain('moments/new-photo-thumb.jpg');
    expect(previews.videoThumbUri).toContain('moments/video-thumb.jpg');
    expect(previews.activityEmoji).toBe('🏃');
    expect(previews.activitySummaries).toEqual([
      {
        activityId: null,
        emoji: '☕',
        count: 1,
        latestMs: new Date('2026-06-08T14:10:00.000Z').getTime(),
      },
      {
        activityId: null,
        emoji: '🏃',
        count: 1,
        latestMs: new Date('2026-06-08T15:10:00.000Z').getTime(),
      },
    ]);
    // Oldest → newest by each chip's latest log time
    expect(
      previews.chipTimeline.map(entry =>
        entry.kind === 'activity' ? entry.emoji : entry.type,
      ),
    ).toEqual(['☕', 'video', 'photo', '🏃', 'mood', 'note', 'voice']);
    expect(previews.moodLabel).toBe('Joyful');
    expect(previews.moodVariant).toBe('dog');
  });

  it('groups unique activities by activityId and counts repeats', () => {
    const previews = latestMomentCountPreviews([
      moment({
        id: 1,
        type: 'activity',
        timestamp: new Date('2026-06-08T14:00:00.000Z'),
        activityId: 10,
        activityEmoji: '🍔',
      }),
      moment({
        id: 2,
        type: 'activity',
        timestamp: new Date('2026-06-08T15:00:00.000Z'),
        activityId: 11,
        activityEmoji: '🤥',
      }),
      moment({
        id: 3,
        type: 'activity',
        timestamp: new Date('2026-06-08T14:30:00.000Z'),
        activityId: 10,
        activityEmoji: '🍔',
      }),
      moment({
        id: 4,
        type: 'activity',
        timestamp: new Date('2026-06-08T16:00:00.000Z'),
        activityId: 12,
        activityEmoji: '🏋️',
      }),
    ]);

    expect(previews.activityEmoji).toBe('🏋️');
    expect(previews.activitySummaries).toEqual([
      {
        activityId: 10,
        emoji: '🍔',
        count: 2,
        latestMs: new Date('2026-06-08T14:30:00.000Z').getTime(),
      },
      {
        activityId: 11,
        emoji: '🤥',
        count: 1,
        latestMs: new Date('2026-06-08T15:00:00.000Z').getTime(),
      },
      {
        activityId: 12,
        emoji: '🏋️',
        count: 1,
        latestMs: new Date('2026-06-08T16:00:00.000Z').getTime(),
      },
    ]);
    expect(
      countMomentCountChips(
        { photo: 1, video: 0, voice: 1, note: 1, activity: 4, mood: 1 },
        previews,
      ),
    ).toBe(3);
  });

  it('leaves photo preview null when thumbnail is missing', () => {
    const previews = latestMomentCountPreviews([
      moment({
        id: 1,
        type: 'photo',
        timestamp: new Date('2026-06-08T14:00:00.000Z'),
        contentPath: 'moments/full.jpg',
        thumbnailPath: null,
      }),
    ]);
    expect(previews.photoThumbUri).toBeNull();
  });
});
