import { enrichStayPlaceFieldsFromVisitDisplay } from '@/hooks/use-day-story-stops';
import type { DetectedTrip } from '@/lib/trip-detection';
import { locationPointRow } from '@/lib/location-point-row';

jest.mock('@/lib/visit-place-label', () => ({
  loadVisitPlaceDisplayForStay: jest.fn(),
}));

const { loadVisitPlaceDisplayForStay } = jest.requireMock(
  '@/lib/visit-place-label',
) as {
  loadVisitPlaceDisplayForStay: jest.Mock;
};

function stay(extras: Partial<DetectedTrip> = {}): DetectedTrip {
  const startAt = new Date('2026-07-13T18:00:00.000Z');
  return {
    id: 'stay-1',
    kind: 'stay',
    points: [
      locationPointRow({
        id: 1,
        timestamp: startAt,
        lat: 33.21,
        lng: -97.13,
      }),
    ],
    startAt,
    endAt: new Date(startAt.getTime() + 60_000),
    distanceKm: 0,
    durationMs: 60_000,
    placeKind: 'cache',
    placeId: 10,
    placeLabel: '123 Main St',
    poiId: 1,
    poiLabel: 'Natural Grocers',
    ...extras,
  };
}

describe('enrichStayPlaceFieldsFromVisitDisplay', () => {
  beforeEach(() => {
    loadVisitPlaceDisplayForStay.mockReset();
  });

  it('replaces the closest-POI timeline label with the History selection', async () => {
    loadVisitPlaceDisplayForStay.mockResolvedValue({
      source: 'lookup',
      addressLabel: '123 Main St',
      primaryLabel: 'CVS Pharmacy',
      candidates: [
        { id: 2, name: 'CVS Pharmacy', source: 'mapkit', category: 'pharmacy' },
      ],
      selectedPoiId: 2,
      cacheId: 10,
      materializedTripId: 99,
      loading: false,
      venueRadiusMeters: 150,
    });

    const enriched = await enrichStayPlaceFieldsFromVisitDisplay(stay(), []);

    expect(enriched.poiId).toBe(2);
    expect(enriched.poiLabel).toBe('CVS Pharmacy');
    expect(enriched.placeLabel).toBe('123 Main St');
  });
});
