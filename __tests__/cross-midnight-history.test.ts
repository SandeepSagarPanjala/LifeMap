import {
  findExcludedCrossMidnightTravel,
  findStayAfterTravel,
  findStayBeforeTravel,
  tripRowToLabelStay,
} from '@/lib/cross-midnight-history';
import { adjacentStaysForTravelIndex } from '@/lib/trip-detection';
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

describe('cross-midnight endpoint stay helpers', () => {
  const travel = makeTripRow({
    id: 10,
    eventKey: 'travel:overnight',
    kind: 'travel',
    dateKey: '2026-07-12',
    startAt: new Date('2026-07-11T22:54:00.000-05:00'),
    endAt: new Date('2026-07-12T00:14:00.000-05:00'),
  });

  it('finds arrival stay after travel for To label', () => {
    const arrival = makeTripRow({
      id: 11,
      eventKey: 'stay:arrival',
      kind: 'stay',
      dateKey: '2026-07-12',
      startAt: new Date('2026-07-12T00:14:00.000-05:00'),
      endAt: new Date('2026-07-12T08:00:00.000-05:00'),
      placeLabel: 'Barista Biryani House',
      poiLabel: 'Barista Biryani House',
    });
    const later = makeTripRow({
      id: 12,
      eventKey: 'stay:later',
      kind: 'stay',
      dateKey: '2026-07-12',
      startAt: new Date('2026-07-12T10:00:00.000-05:00'),
      endAt: new Date('2026-07-12T11:00:00.000-05:00'),
      placeLabel: 'Somewhere Else',
    });

    expect(findStayAfterTravel([later, arrival, travel], travel)?.id).toBe(11);
  });

  it('finds departure stay before travel for From label', () => {
    const departure = makeTripRow({
      id: 9,
      eventKey: 'stay:departure',
      kind: 'stay',
      dateKey: '2026-07-11',
      startAt: new Date('2026-07-11T18:00:00.000-05:00'),
      endAt: new Date('2026-07-11T22:54:00.000-05:00'),
      placeLabel: 'Victory Tap Sports Lounge',
      poiLabel: 'Victory Tap Sports Lounge',
    });
    const earlier = makeTripRow({
      id: 8,
      eventKey: 'stay:earlier',
      kind: 'stay',
      dateKey: '2026-07-11',
      startAt: new Date('2026-07-11T12:00:00.000-05:00'),
      endAt: new Date('2026-07-11T14:00:00.000-05:00'),
      placeLabel: 'Home',
    });

    expect(findStayBeforeTravel([earlier, departure], travel)?.id).toBe(9);
  });

  it('adjacentStaysForTravelIndex uses attached cross-day label stays', () => {
    const fromStay = tripRowToLabelStay(
      makeTripRow({
        id: 9,
        eventKey: 'stay:from',
        kind: 'stay',
        dateKey: '2026-07-11',
        startAt: new Date('2026-07-11T18:00:00.000-05:00'),
        endAt: new Date('2026-07-11T22:54:00.000-05:00'),
        poiLabel: 'Victory Tap Sports Lounge',
      }),
    );
    const toStay = tripRowToLabelStay(
      makeTripRow({
        id: 11,
        eventKey: 'stay:to',
        kind: 'stay',
        dateKey: '2026-07-12',
        startAt: new Date('2026-07-12T00:14:00.000-05:00'),
        endAt: new Date('2026-07-12T08:00:00.000-05:00'),
        poiLabel: 'Barista Biryani House',
      }),
    );
    const overnight = {
      ...tripRowToLabelStay(travel),
      kind: 'travel' as const,
      crossDayLabelStayPrevious: fromStay,
      crossDayLabelStayNext: toStay,
    };

    const adjacent = adjacentStaysForTravelIndex([overnight], 0);
    expect(adjacent.previousStay?.poiLabel).toBe('Victory Tap Sports Lounge');
    expect(adjacent.nextStay?.poiLabel).toBe('Barista Biryani House');
  });
});
