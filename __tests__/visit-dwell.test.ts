import type {SavedPlaceRow} from '@/db/repositories/saved-places';
import type {DetectedTrip} from '@/lib/trip-detection';
import {buildTripDetectionConfig} from '@/lib/trip-settings';
import {
  minimumVisitDwellMinutes,
  stayMeetsMinimumVisitDwell,
} from '@/lib/visit-dwell';

const config = buildTripDetectionConfig(10, 5, 20);

const savedPlaces: SavedPlaceRow[] = [
  {
    id: 1,
    kind: 'favorite',
    label: 'Sravani Work',
    lat: 33.2,
    lng: -97.1,
    radiusMeters: 150,
    addressLine: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
  },
];

function makeStay(
  durationMs: number,
  lat = 33.2,
  lng = -97.1,
): DetectedTrip {
  const startAt = new Date('2026-06-13T22:33:00.000Z');
  return {
    id: 'stay-0',
    kind: 'stay',
    points: [
      {
        id: 1,
        timestamp: startAt,
        lat,
        lng,
        accuracy: 10,
        altitude: null,
        speed: 0,
        source: 'gps',
      },
      {
        id: 2,
        timestamp: new Date(startAt.getTime() + durationMs),
        lat,
        lng,
        accuracy: 10,
        altitude: null,
        speed: 0,
        source: 'gps',
      },
    ],
    startAt,
    endAt: new Date(startAt.getTime() + durationMs),
    distanceKm: 0,
    durationMs,
  };
}

describe('visit dwell rules', () => {
  it('requires 1 minute at a saved place', () => {
    const stay = makeStay(60_000);
    expect(minimumVisitDwellMinutes(config, stay, savedPlaces)).toBe(1);
    expect(stayMeetsMinimumVisitDwell(stay, config, savedPlaces)).toBe(true);
  });

  it('does not count a saved-place stop shorter than 1 minute', () => {
    const stay = makeStay(30_000);
    expect(stayMeetsMinimumVisitDwell(stay, config, savedPlaces)).toBe(false);
  });

  it('requires 5 minutes at other places', () => {
    const stay = makeStay(4 * 60_000, 33.25, -97.15);
    expect(minimumVisitDwellMinutes(config, stay, savedPlaces)).toBe(5);
    expect(stayMeetsMinimumVisitDwell(stay, config, savedPlaces)).toBe(false);
  });

  it('counts a 5 minute stop at other places', () => {
    const stay = makeStay(5 * 60_000, 33.25, -97.15);
    expect(stayMeetsMinimumVisitDwell(stay, config, savedPlaces)).toBe(true);
  });
});
