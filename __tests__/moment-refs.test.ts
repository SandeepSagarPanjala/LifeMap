import type { TripPointRow } from '@/db/repositories/trip-points';
import { makeMoment } from './helpers/fixtures';
import {
  buildMomentRefsForSegment,
  momentCountsFromRefs,
  momentsForTripRefs,
  parseMomentRefs,
  routeMomentAnchorsFromTripPoints,
  serializeMomentRefs,
} from '@/lib/moment-refs';

function moment(
  id: number,
  iso: string,
  type: 'note' | 'photo' | 'voice' = 'note',
) {
  return makeMoment({ id, timestamp: new Date(iso), type });
}

describe('moment refs', () => {
  it('builds ordered refs for moments inside a segment window', () => {
    const startAt = new Date('2026-06-17T10:00:00.000Z');
    const endAt = new Date('2026-06-17T11:00:00.000Z');
    const refs = buildMomentRefsForSegment(
      [
        moment(1, '2026-06-17T09:59:00.000Z'),
        moment(2, '2026-06-17T10:15:00.000Z', 'photo'),
        moment(3, '2026-06-17T10:45:00.000Z', 'voice'),
        moment(4, '2026-06-17T11:01:00.000Z'),
      ],
      startAt,
      endAt,
    );
    expect(refs).toEqual([
      { momentId: 2, momentKind: 'photo' },
      { momentId: 3, momentKind: 'voice' },
    ]);
  });

  it('round-trips serialized refs', () => {
    const refs = [
      { momentId: 10, momentKind: 'note' as const },
      { momentId: 11, momentKind: 'activity' as const },
    ];
    expect(parseMomentRefs(serializeMomentRefs(refs))).toEqual(refs);
  });

  it('counts refs by kind', () => {
    const counts = momentCountsFromRefs([
      { momentId: 1, momentKind: 'photo' },
      { momentId: 2, momentKind: 'photo' },
      { momentId: 3, momentKind: 'voice' },
    ]);
    expect(counts).toEqual({
      photo: 2,
      video: 0,
      voice: 1,
      note: 0,
      activity: 0,
    });
  });

  it('hydrates moment rows from refs in display order', () => {
    const dayMoments = [
      moment(1, '2026-06-17T10:00:00.000Z', 'note'),
      moment(2, '2026-06-17T10:30:00.000Z', 'photo'),
    ];
    expect(
      momentsForTripRefs(dayMoments, [
        { momentId: 2, momentKind: 'photo' },
        { momentId: 99, momentKind: 'note' },
      ]).map(row => row.id),
    ).toEqual([2]);
  });

  it('extracts drive anchors from trip points', () => {
    const route: TripPointRow[] = [
      {
        id: 1,
        tripId: 5,
        seq: 0,
        lat: 33.2,
        lng: -97.1,
        recordedAt: new Date('2026-06-17T10:00:00.000Z'),
        locationPointId: 100,
        source: 'gps',
        momentId: null,
      },
      {
        id: 2,
        tripId: 5,
        seq: 1,
        lat: 33.21,
        lng: -97.11,
        recordedAt: new Date('2026-06-17T10:15:00.000Z'),
        locationPointId: 101,
        source: 'gps',
        momentId: 42,
      },
    ];
    expect(routeMomentAnchorsFromTripPoints(route)).toEqual([
      { momentId: 42, lat: 33.21, lng: -97.11 },
    ]);
  });
});
