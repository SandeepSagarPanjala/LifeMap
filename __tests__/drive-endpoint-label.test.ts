import {
  EMPTY_DRIVE_ENDPOINT_LABEL,
  resolveDriveEndpointLabelFromStaySync,
} from '../src/lib/drive-endpoint-label';
import type {SavedPlaceRow} from '../src/db/repositories/saved-places';
import {
  adjacentStaysForTravelIndex,
  type DayTimelineEntry,
  type DetectedTrip,
} from '../src/lib/trip-detection';

describe('drive endpoint labels', () => {
  const home: SavedPlaceRow = {
    id: 1,
    kind: 'home',
    label: 'Home',
    lat: 33.2,
    lng: -97.1,
    radiusMeters: 150,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  };

  const homeStay: DetectedTrip = {
    id: 'stay-home',
    kind: 'stay',
    points: [
      {
        id: 1,
        lat: 33.2,
        lng: -97.1,
        timestamp: new Date('2026-06-09T12:00:00.000Z'),
        accuracyM: 10,
        speedMps: 0,
        headingDeg: null,
        altitudeM: null,
      },
    ],
    startAt: new Date('2026-06-09T12:00:00.000Z'),
    endAt: new Date('2026-06-09T12:30:00.000Z'),
    distanceKm: 0,
    durationMs: 30 * 60_000,
  };

  const travel: DetectedTrip = {
    id: 'travel-1',
    kind: 'travel',
    points: [
      {
        id: 2,
        lat: 33.21,
        lng: -97.11,
        timestamp: new Date('2026-06-09T12:30:00.000Z'),
        accuracyM: 10,
        speedMps: 5,
        headingDeg: null,
        altitudeM: null,
      },
      {
        id: 3,
        lat: 33.22,
        lng: -97.12,
        timestamp: new Date('2026-06-09T12:45:00.000Z'),
        accuracyM: 10,
        speedMps: 5,
        headingDeg: null,
        altitudeM: null,
      },
    ],
    startAt: new Date('2026-06-09T12:30:00.000Z'),
    endAt: new Date('2026-06-09T12:45:00.000Z'),
    distanceKm: 3,
    durationMs: 15 * 60_000,
  };

  const libraryStay: DetectedTrip = {
    id: 'stay-library',
    kind: 'stay',
    points: [
      {
        id: 4,
        lat: 33.23,
        lng: -97.13,
        timestamp: new Date('2026-06-09T12:45:00.000Z'),
        accuracyM: 10,
        speedMps: 0,
        headingDeg: null,
        altitudeM: null,
      },
    ],
    startAt: new Date('2026-06-09T12:45:00.000Z'),
    endAt: new Date('2026-06-09T13:00:00.000Z'),
    distanceKm: 0,
    durationMs: 15 * 60_000,
  };

  const entries: DayTimelineEntry[] = [homeStay, travel, libraryStay];

  it('resolves saved place labels from adjacent visits', () => {
    const start = resolveDriveEndpointLabelFromStaySync(homeStay, [home]);
    const end = resolveDriveEndpointLabelFromStaySync(libraryStay, [home]);

    expect(start).toMatchObject({
      source: 'saved',
      text: 'Home',
      savedPlace: home,
    });
    expect(end).toEqual(EMPTY_DRIVE_ENDPOINT_LABEL);
  });

  it('finds previous and next stays for a travel index', () => {
    expect(adjacentStaysForTravelIndex(entries, 1)).toEqual({
      previousStay: homeStay,
      nextStay: libraryStay,
    });
  });
});
