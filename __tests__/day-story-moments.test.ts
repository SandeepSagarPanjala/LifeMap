import {
  collectMomentsForDayStoryStop,
  momentCountsForDayStoryStop,
} from '../src/lib/day-story-moments';
import { buildDayStoryStops } from '../src/lib/day-story-stops';
import type { DetectedTrip } from '../src/lib/trip-detection';
import type { SavedPlaceRow } from '../src/db/repositories/saved-places';
import { makeMoment } from './helpers/fixtures';

function stay(
  id: string,
  startIso: string,
  lat: number,
  lng: number,
  extras: Partial<DetectedTrip> = {},
): DetectedTrip {
  const startAt = new Date(startIso);
  return {
    id,
    kind: 'stay',
    points: [
      {
        id: 1,
        timestamp: startAt,
        lat,
        lng,
        accuracy: 10,
        altitude: null,
        speed: null,
        source: 'gps',
      },
    ],
    startAt,
    endAt: new Date(startAt.getTime() + 3_600_000),
    distanceKm: 0,
    durationMs: 3_600_000,
    anchorLat: lat,
    anchorLng: lng,
    ...extras,
  };
}

const home: SavedPlaceRow = {
  id: 1,
  kind: 'home',
  label: 'Home',
  lat: 33.23,
  lng: -97.16,
  radiusMeters: 150,
  addressLine: null,
  active: true,
  createdAt: new Date(),
};

describe('collectMomentsForDayStoryStop', () => {
  it('unions moments from every visit at a multi-number Home stop', () => {
    const morning = stay('h1', '2026-07-10T08:00:00.000Z', 33.23, -97.16, {
      placeKind: 'saved',
      placeId: 1,
      placeLabel: 'Home',
    });
    const evening = stay('h2', '2026-07-10T20:00:00.000Z', 33.23, -97.16, {
      placeKind: 'saved',
      placeId: 1,
      placeLabel: 'Home',
    });
    const stops = buildDayStoryStops([morning, evening], [home]);
    const homeStop = stops.find(stop => stop.isHome)!;
    expect(homeStop.visitNumbers).toEqual([1, 2]);

    const dayMoments = [
      makeMoment({
        id: 1,
        type: 'photo',
        timestamp: new Date('2026-07-10T08:30:00.000Z'),
      }),
      makeMoment({
        id: 2,
        type: 'voice',
        timestamp: new Date('2026-07-10T20:15:00.000Z'),
      }),
    ];
    const entries = [morning, evening];
    const collected = collectMomentsForDayStoryStop(
      homeStop,
      dayMoments,
      [home],
      [],
      entries,
      150,
    );
    expect(collected.map(row => row.id).sort()).toEqual([1, 2]);
    expect(
      momentCountsForDayStoryStop(
        homeStop,
        dayMoments,
        [home],
        [],
        entries,
        150,
      ),
    ).toEqual({
      photo: 1,
      video: 0,
      voice: 1,
      note: 0,
      activity: 0,
    });
  });
});
