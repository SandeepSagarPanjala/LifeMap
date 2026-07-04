import type {MomentRow} from '@/db/repositories/moments';
import type {LocationPointRow} from '@/db/repositories/location-days';
import {canonicalizeStayGeometry} from '@/lib/stay-geometry';
import type {DetectedTrip} from '@/lib/trip-detection';

function point(
  id: number,
  iso: string,
  lat: number,
  lng: number,
  speed: number | null = null,
): LocationPointRow {
  return {
    id,
    timestamp: new Date(iso),
    lat,
    lng,
    accuracy: 10,
    altitude: null,
    speed,
    source: 'gps',
  };
}

function homeStay(points: LocationPointRow[]): DetectedTrip {
  const startAt = points[0]!.timestamp;
  const endAt = points[points.length - 1]!.timestamp;
  return {
    id: 'stay-1',
    kind: 'stay',
    points,
    startAt,
    endAt,
    durationMs: endAt.getTime() - startAt.getTime(),
    distanceKm: 0,
    placeLabel: 'Home',
    placeId: 1,
    placeKind: 'saved' as const,
  };
}

describe('canonicalizeStayGeometry', () => {
  it('reduces a long home stay to arrival, departure, and centroid', () => {
    const stay = homeStay([
      point(1, '2026-06-17T10:00:00.000Z', 33.25, -97.15),
      point(2, '2026-06-17T12:00:00.000Z', 33.2501, -97.1501),
      point(3, '2026-06-17T18:00:00.000Z', 33.2502, -97.1502),
      point(4, '2026-06-17T22:00:00.000Z', 33.2503, -97.1503),
    ]);

    const canonical = canonicalizeStayGeometry(stay, {lat: 33.25, lng: -97.15});

    expect(canonical.map(row => row.id)).toEqual([1, 4]);
  });

  it('keeps moment-nearest points for saved-place stays', () => {
    const stay = homeStay([
      point(1, '2026-06-17T10:00:00.000Z', 33.25, -97.15),
      point(2, '2026-06-17T12:05:00.000Z', 33.2504, -97.1504),
      point(3, '2026-06-17T18:00:00.000Z', 33.2502, -97.1502),
      point(4, '2026-06-17T22:00:00.000Z', 33.2503, -97.1503),
    ]);
    const moments: MomentRow[] = [
      {
        id: 9,
        type: 'photo',
        timestamp: new Date('2026-06-17T12:04:00.000Z'),
        finishedAt: null,
        lat: null,
        lng: null,
        contentPath: null,
        voiceAttachmentPath: null,
        voiceAttachmentBytes: null,
        voiceDurationSec: null,
        photoAttachmentsJson: null,
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
        activityId: null,
        activityEmoji: null,
        activityLabel: null,
      },
    ];

    const canonical = canonicalizeStayGeometry(
      stay,
      {lat: 33.25, lng: -97.15},
      moments,
    );

    expect(canonical.map(row => row.id)).toEqual([1, 2, 4]);
  });
});
