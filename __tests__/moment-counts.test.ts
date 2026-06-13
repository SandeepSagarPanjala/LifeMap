import {
  buildTravelMomentMarkers,
  countMoments,
  countMomentsForEntry,
  emptyMomentCounts,
  filterMomentsForEntry,
  shouldHideSavedPlaceMomentCluster,
  shouldShowDayMomentSummaryBar,
} from '../src/lib/moments/moment-counts';
import type {MomentRow} from '../src/db/repositories/moments';
import type {DayTimelineEntry} from '../src/lib/trip-detection';

function moment(partial: Partial<MomentRow> & Pick<MomentRow, 'id' | 'type' | 'timestamp'>): MomentRow {
  return {
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
    ...partial,
  };
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
        moment({id: 1, type: 'photo', timestamp: new Date('2026-06-08T14:00:00.000Z')}),
        moment({id: 2, type: 'voice', timestamp: new Date('2026-06-08T14:30:00.000Z')}),
        moment({id: 3, type: 'note', timestamp: new Date('2026-06-08T15:00:00.000Z')}),
        moment({id: 4, type: 'photo', timestamp: new Date('2026-06-08T15:30:00.000Z')}),
      ]),
    ).toEqual({photo: 2, voice: 1, note: 1});
  });

  it('counts moments inside a visit entry', () => {
    const counts = countMomentsForEntry(
      [
        moment({id: 1, type: 'photo', timestamp: new Date('2026-06-08T14:00:00.000Z')}),
        moment({id: 2, type: 'voice', timestamp: new Date('2026-06-08T11:30:00.000Z')}),
      ],
      stay,
      now,
    );
    expect(counts).toEqual({photo: 1, voice: 0, note: 0});
  });

  it('builds travel markers at interpolated GPS points', () => {
    const markers = buildTravelMomentMarkers(
      [moment({id: 1, type: 'photo', timestamp: new Date('2026-06-08T11:30:00.000Z')})],
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
        },
      ],
      now,
    );

    expect(markers).toHaveLength(1);
    expect(markers[0]?.counts).toEqual({...emptyMomentCounts(), photo: 1});
    expect(markers[0]?.momentIds).toEqual([1]);
    expect(markers[0]?.coordinate).toEqual({latitude: 33.5, longitude: -96.5});
  });

  it('filters moments for a timeline entry', () => {
    const moments = [
      moment({id: 1, type: 'photo', timestamp: new Date('2026-06-08T14:00:00.000Z')}),
      moment({id: 2, type: 'voice', timestamp: new Date('2026-06-08T10:00:00.000Z')}),
      moment({id: 3, type: 'note', timestamp: new Date('2026-06-08T15:00:00.000Z')}),
    ];

    expect(filterMomentsForEntry(moments, stay, now).map(item => item.id)).toEqual([
      1, 3,
    ]);
  });

  it('hides the day summary bar when every moment is on the open visit callout', () => {
    const dayCounts = {photo: 1, voice: 1, note: 0};
    expect(shouldShowDayMomentSummaryBar(dayCounts, stay, dayCounts)).toBe(
      false,
    );
  });

  it('keeps the day summary bar when moments exist outside the open visit', () => {
    const dayCounts = {photo: 2, voice: 1, note: 0};
    const visitCounts = {photo: 1, voice: 0, note: 0};
    expect(shouldShowDayMomentSummaryBar(dayCounts, stay, visitCounts)).toBe(
      true,
    );
  });

  it('hides the saved-place cluster when the stay callout already shows moments', () => {
    const counts = {photo: 3, voice: 1, note: 1};
    expect(shouldHideSavedPlaceMomentCluster(7, 7, counts)).toBe(true);
    expect(shouldHideSavedPlaceMomentCluster(7, 8, counts)).toBe(false);
    expect(shouldHideSavedPlaceMomentCluster(7, 7, emptyMomentCounts())).toBe(
      false,
    );
  });
});
