import { findExcludedCrossMidnightTravel } from '@/lib/cross-midnight-history';
import { makeTripRow } from './helpers/trip-row-fixture';

describe('findExcludedCrossMidnightTravel', () => {
  it('matches the overnight travel by exact start ms', () => {
    const startAt = new Date('2026-07-02T23:10:30.000-05:00');
    const trips = [
      makeTripRow({
        id: 1,
        eventKey: 'travel:a',
        kind: 'travel',
        dateKey: '2026-07-03',
        startAt: new Date('2026-07-03T08:00:00.000-05:00'),
        endAt: new Date('2026-07-03T09:00:00.000-05:00'),
      }),
      makeTripRow({
        id: 2,
        eventKey: 'travel:overnight',
        kind: 'travel',
        dateKey: '2026-07-03',
        startAt,
        endAt: new Date('2026-07-03T00:28:00.000-05:00'),
      }),
    ];

    expect(
      findExcludedCrossMidnightTravel(trips, startAt.getTime())?.id,
    ).toBe(2);
  });

  it('returns null when next day is not sealed with that drive', () => {
    const trips = [
      makeTripRow({
        id: 1,
        eventKey: 'travel:morning',
        kind: 'travel',
        dateKey: '2026-07-03',
        startAt: new Date('2026-07-03T08:00:00.000-05:00'),
        endAt: new Date('2026-07-03T09:00:00.000-05:00'),
      }),
    ];
    expect(
      findExcludedCrossMidnightTravel(
        trips,
        Date.parse('2026-07-02T23:10:00.000Z'),
      ),
    ).toBeNull();
  });
});
