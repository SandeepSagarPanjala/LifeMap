import {
  DAY_STORY_VISIT_COLORS,
  dayStoryCardFill,
  dayStoryColorForVisit,
  dayStoryRouteFill,
} from '../src/lib/day-story-colors';
import {
  chronologicalStayVisitNumbers,
  originVisitNumberForTravel,
} from '../src/lib/day-story-stops';
import type { DetectedTrip } from '../src/lib/trip-detection';

function stay(
  id: string,
  startIso: string,
  lat: number,
  lng: number,
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
    endAt: new Date(startAt.getTime() + 60_000),
    distanceKm: 0,
    durationMs: 60_000,
    anchorLat: lat,
    anchorLng: lng,
  };
}

function travel(id: string, startIso: string): DetectedTrip {
  const startAt = new Date(startIso);
  return {
    id,
    kind: 'travel',
    points: [
      {
        id: 1,
        timestamp: startAt,
        lat: 33.2,
        lng: -97.1,
        accuracy: 10,
        altitude: null,
        speed: null,
        source: 'gps',
      },
      {
        id: 2,
        timestamp: new Date(startAt.getTime() + 60_000),
        lat: 33.21,
        lng: -97.11,
        accuracy: 10,
        altitude: null,
        speed: null,
        source: 'gps',
      },
    ],
    startAt,
    endAt: new Date(startAt.getTime() + 60_000),
    distanceKm: 1,
    durationMs: 60_000,
  };
}

describe('day-story-colors', () => {
  it('has at least 50 unique colors', () => {
    expect(DAY_STORY_VISIT_COLORS.length).toBeGreaterThanOrEqual(50);
    expect(new Set(DAY_STORY_VISIT_COLORS).size).toBe(
      DAY_STORY_VISIT_COLORS.length,
    );
  });

  it('cycles visit colors by number', () => {
    expect(dayStoryColorForVisit(1)).toBe(DAY_STORY_VISIT_COLORS[0]);
    expect(dayStoryColorForVisit(2)).toBe(DAY_STORY_VISIT_COLORS[1]);
    expect(dayStoryColorForVisit(DAY_STORY_VISIT_COLORS.length + 1)).toBe(
      DAY_STORY_VISIT_COLORS[0],
    );
  });

  it('builds route fill at 0.5 opacity', () => {
    expect(dayStoryRouteFill('#007AFF', 0.5)).toBe('rgba(0, 122, 255, 0.5)');
  });

  it('builds a soft white-mixed card fill from visit color', () => {
    expect(dayStoryCardFill('#007AFF', 0)).toBe('rgb(255, 255, 255)');
    expect(dayStoryCardFill('#007AFF', 1)).toBe('rgb(0, 122, 255)');
    // ~14% blue wash stays light
    expect(dayStoryCardFill('#007AFF', 0.14)).toBe('rgb(219, 236, 255)');
  });
});

describe('originVisitNumberForTravel', () => {
  it('maps a drive to the previous stay visit number', () => {
    const s1 = stay('s1', '2026-07-11T08:00:00.000Z', 33.23, -97.16);
    const t1 = travel('t1', '2026-07-11T09:00:00.000Z');
    const s2 = stay('s2', '2026-07-11T10:00:00.000Z', 33.25, -97.14);
    const visitByStayId = chronologicalStayVisitNumbers([s1, s2]);
    expect(visitByStayId.get('s1')).toBe(1);
    expect(
      originVisitNumberForTravel([s1, t1, s2], 't1', visitByStayId),
    ).toBe(1);
  });
});
