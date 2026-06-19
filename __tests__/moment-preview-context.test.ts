import {
  buildMomentPreviewContextForEntry,
  formatMomentsPreviewSheetTitle,
  resolveMomentPreviewContext,
} from '../src/lib/moments/moment-preview-context';
import type {SavedPlaceRow} from '../src/db/repositories/saved-places';
import type {DayTimelineEntry} from '../src/lib/trip-detection';

describe('moment preview context', () => {
  const now = new Date('2026-06-09T18:00:00.000Z');

  const kroger: SavedPlaceRow = {
    id: 3,
    kind: 'favorite',
    label: 'Kroger',
    lat: 33.21,
    lng: -97.14,
    radiusMeters: 150,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
  };

  const krogerStay: DayTimelineEntry = {
    id: 'stay-kroger',
    kind: 'stay',
    points: [
      {
        id: 1,
        lat: 33.21,
        lng: -97.14,
        timestamp: new Date('2026-06-09T14:00:00.000Z'),
        accuracy: 10,
        speed: 0,
        altitude: null,
        source: 'gps',
      },
    ],
    startAt: new Date('2026-06-09T14:00:00.000Z'),
    endAt: new Date('2026-06-09T14:42:00.000Z'),
    distanceKm: 0,
    durationMs: 42 * 60_000,
  };

  const drive: DayTimelineEntry = {
    id: 'travel-1',
    kind: 'travel',
    points: [],
    startAt: new Date('2026-06-09T12:00:00.000Z'),
    endAt: new Date('2026-06-09T12:20:00.000Z'),
    distanceKm: 8,
    durationMs: 20 * 60_000,
  };

  it('links a moment timestamp to a visit with saved place label', () => {
    const momentAt = new Date('2026-06-09T14:10:00.000Z');
    const context = resolveMomentPreviewContext(
      momentAt,
      [drive, krogerStay],
      [kroger],
      'mi',
      now,
    );

    expect(context).toMatchObject({
      entryKind: 'stay',
      kindLabel: 'Visit',
      placeLabel: 'Kroger',
      entryId: 'stay-kroger',
    });
    expect(context?.timeLabel).toContain('9:00 AM');
    expect(context?.statsLabel).toBe('42 min');
  });

  it('builds a drive context when the moment is on a trip', () => {
    const momentAt = new Date('2026-06-09T12:10:00.000Z');
    const context = resolveMomentPreviewContext(
      momentAt,
      [drive, krogerStay],
      [kroger],
      'mi',
      now,
    );

    expect(context).toMatchObject({
      entryKind: 'travel',
      kindLabel: 'Drive',
      placeLabel: null,
      entryId: 'travel-1',
    });
    expect(context?.statsLabel).toBe('5.0 mi · 20 min');
  });

  it('titles a single map-pin preview with the visit place name', () => {
    const title = formatMomentsPreviewSheetTitle(
      {kind: 'moment-ids', title: 'Moment'},
      [{timestamp: new Date('2026-06-09T14:10:00.000Z')}],
      [drive, krogerStay],
      [kroger],
      'Tue, Jun 9',
      'mi',
      now,
    );

    expect(title).toBe('Kroger moments');
  });

  it('titles an entry-scoped visit preview with the saved place name', () => {
    const title = formatMomentsPreviewSheetTitle(
      {kind: 'entry', entry: krogerStay},
      [{timestamp: new Date('2026-06-09T14:10:00.000Z')}],
      [krogerStay],
      [kroger],
      'Tue, Jun 9',
      'mi',
      now,
    );

    expect(title).toBe('Kroger moments');
  });

  it('falls back to Visit moments when no saved place matches', () => {
    const context = buildMomentPreviewContextForEntry(krogerStay, [], 'mi', now);
    expect(context.placeLabel).toBeNull();

    const title = formatMomentsPreviewSheetTitle(
      {kind: 'entry', entry: krogerStay},
      [{timestamp: new Date('2026-06-09T14:10:00.000Z')}],
      [krogerStay],
      [],
      'Tue, Jun 9',
      'mi',
      now,
    );

    expect(title).toBe('Visit moments');
  });
});
