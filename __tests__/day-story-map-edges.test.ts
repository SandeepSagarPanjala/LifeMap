import { buildDayStoryStayConnectors } from '@/lib/day-story-stay-connectors';
import { travelDisplayPointsForTimeline } from '@/lib/history-map-plan';
import { dayStoryColorForVisit } from '@/lib/day-story-colors';
import type { DayStoryStop } from '@/lib/day-story-stops';
import { buildTripDetectionConfig } from '@/lib/trip-settings';
import type { DayTimelineEntry, DetectedTrip } from '@/lib/trip-detection';

function gps(
  id: number,
  minutes: number,
  lat: number,
  lng: number,
  speed: number | null,
) {
  return {
    id,
    timestamp: new Date(
      `2026-07-17T12:${String(minutes).padStart(2, '0')}:00Z`,
    ),
    lat,
    lng,
    accuracy: 8,
    altitude: null,
    speed,
    source: 'gps',
    heading: null,
    headingAccuracy: null,
    speedAccuracy: null,
    altitudeAccuracy: null,
    activityType: null,
    activityConfidence: null,
    isMoving: null,
    isMock: null,
    uuid: null,
    batteryLevel: null,
    batteryIsCharging: null,
  };
}

function stayAt(
  id: string,
  anchorLat: number,
  anchorLng: number,
  points: DetectedTrip['points'],
): DetectedTrip {
  return {
    id,
    kind: 'stay',
    points,
    startAt: points[0]!.timestamp,
    endAt: points[points.length - 1]!.timestamp,
    durationMs:
      points[points.length - 1]!.timestamp.getTime() -
      points[0]!.timestamp.getTime(),
    distanceKm: 0,
    anchorLat,
    anchorLng,
  };
}

function stopOf(stay: DetectedTrip, n: number): DayStoryStop {
  return {
    key: stay.id,
    visitNumbers: [n],
    stayIds: [stay.id],
    stays: [stay],
    coordinate: { latitude: stay.anchorLat!, longitude: stay.anchorLng! },
    label: `V${n}`,
    isHome: false,
    savedPlaceId: null,
    poiId: null,
    poiCategory: null,
  };
}

describe('day browse map edges (History helpers)', () => {
  const config = buildTripDetectionConfig(10, 5, 75);

  it('connectors use visitCore start/end with History visit colors', () => {
    const a = stayAt('a', 33.2, -97.13, [
      gps(1, 0, 33.2, -97.13, 0),
      gps(2, 10, 33.2, -97.13, 0),
    ]);
    const b = stayAt('b', 33.2313, -97.1326, [
      gps(3, 40, 33.2309, -97.1326, 0),
      gps(4, 50, 33.2313, -97.1326, 0),
      gps(5, 60, 33.2313, -97.1321, 0),
    ]);
    const connectors = buildDayStoryStayConnectors(
      [stopOf(a, 1), stopOf(b, 2)],
      [a, b],
    );
    const arrival = connectors.find(c => c.key === 'arrival-b');
    const departure = connectors.find(c => c.key === 'departure-b');
    expect(arrival?.color).toBe(dayStoryColorForVisit(1));
    expect(departure?.color).toBe(dayStoryColorForVisit(2));
    expect(arrival?.coordinates).toHaveLength(2);
    expect(departure?.coordinates).toHaveLength(2);
  });

  it('travel path reuses History inbound into the next stay', () => {
    const a = stayAt('a', 33.2, -97.13, [
      gps(1, 0, 33.2, -97.13, 0),
      gps(2, 10, 33.2, -97.13, 0),
    ]);
    const travel: DetectedTrip = {
      id: 't',
      kind: 'travel',
      points: [
        gps(3, 11, 33.201, -97.13, 8),
        gps(4, 18, 33.2305, -97.1326, 3),
      ],
      startAt: new Date('2026-07-17T12:11:00Z'),
      endAt: new Date('2026-07-17T12:18:00Z'),
      durationMs: 420_000,
      distanceKm: 3,
    };
    const b = stayAt('b', 33.2313, -97.1326, [
      gps(5, 19, 33.2309, -97.1326, 0.3),
      gps(6, 40, 33.2313, -97.1326, 0),
    ]);
    const entries: DayTimelineEntry[] = [a, travel, b];
    const points = travelDisplayPointsForTimeline(travel, entries, config);
    expect(points.some(p => p.id === 5)).toBe(true);
    expect(points.some(p => p.id === 6)).toBe(false);
  });
});
