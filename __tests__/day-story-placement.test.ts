import {
  assignDayStoryCardSides,
  bestPairSides,
  blockedCardSidesForStop,
  cardSideFromTravelBearing,
  eliminatedCardSidesForStop,
  findInboundTravelForStay,
  pathSideComingFrom,
  pathSideGoingTo,
  preferredCardSideForStop,
  sideAwayFromNeighbor,
  sidesForTravelDirection,
  sidesTowardNeighbor,
} from '../src/lib/day-story-placement';
import { buildDayStoryStops } from '../src/lib/day-story-stops';
import type { DetectedTrip } from '../src/lib/trip-detection';
import type { SavedPlaceRow } from '../src/db/repositories/saved-places';

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
    endAt: new Date(startAt.getTime() + 60_000),
    distanceKm: 0,
    durationMs: 60_000,
    anchorLat: lat,
    anchorLng: lng,
    ...extras,
  };
}

function travel(
  id: string,
  startIso: string,
  points: { lat: number; lng: number }[],
): DetectedTrip {
  const startAt = new Date(startIso);
  return {
    id,
    kind: 'travel',
    points: points.map((point, index) => ({
      id: index + 1,
      timestamp: new Date(startAt.getTime() + index * 60_000),
      lat: point.lat,
      lng: point.lng,
      accuracy: 10,
      altitude: null,
      speed: null,
      source: 'gps' as const,
    })),
    startAt,
    endAt: new Date(startAt.getTime() + points.length * 60_000),
    distanceKm: 1,
    durationMs: points.length * 60_000,
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

describe('day-story-placement', () => {
  it('maps travel bearing to cardinal sides', () => {
    expect(cardSideFromTravelBearing(0)).toBe('top');
    expect(cardSideFromTravelBearing(90)).toBe('right');
    expect(pathSideComingFrom(90)).toBe('left');
    expect(pathSideGoingTo(90)).toBe('right');
    expect(sidesForTravelDirection(45).sort()).toEqual(['right', 'top']);
  });

  it('defaults first stop without drives to left (first free default)', () => {
    const homeStay = stay('h1', '2026-07-11T08:00:00.000Z', 33.23, -97.16, {
      placeKind: 'saved',
      placeId: 1,
      placeLabel: 'Home',
    });
    const stops = buildDayStoryStops([homeStay], [home]);
    expect(preferredCardSideForStop(stops[0]!, [homeStay])).toBe('left');
  });

  it('always places Home card above its badges', () => {
    const homeStay = stay('h1', '2026-07-11T08:00:00.000Z', 33.23, -97.16, {
      placeKind: 'saved',
      placeId: 1,
      placeLabel: 'Home',
    });
    const shop = stay('s1', '2026-07-11T10:00:00.000Z', 33.25, -97.14, {
      placeKind: 'cache',
      poiId: 2,
      poiLabel: 'Shop',
    });
    const drive = travel('t1', '2026-07-11T09:00:00.000Z', [
      { lat: 33.23, lng: -97.16 },
      { lat: 33.24, lng: -97.15 },
      { lat: 33.25, lng: -97.14 },
    ]);
    const entries = [homeStay, drive, shop];
    const stops = buildDayStoryStops([homeStay, shop], [home]);
    const homeStop = stops.find(s => s.isHome)!;
    const sides = assignDayStoryCardSides(stops, entries, 700);
    expect(sides.get(homeStop.key)).toBe('top');
  });

  it('blocks left when coming from left and leaving left', () => {
    const inbound = travel('tin', '2026-07-11T09:00:00.000Z', [
      { lat: 33.25, lng: -97.13 },
      { lat: 33.25, lng: -97.135 },
      { lat: 33.25, lng: -97.14 },
    ]);
    const shop = stay('s1', '2026-07-11T10:00:00.000Z', 33.25, -97.14, {
      placeKind: 'cache',
      poiId: 2,
      poiLabel: 'Flower Child',
    });
    const outbound = travel('tout', '2026-07-11T11:00:00.000Z', [
      { lat: 33.25, lng: -97.14 },
      { lat: 33.25, lng: -97.145 },
      { lat: 33.25, lng: -97.15 },
    ]);
    const entries = [inbound, shop, outbound];
    const stops = buildDayStoryStops([shop]);
    const blocked = blockedCardSidesForStop(stops[0]!, entries);
    expect(blocked.has('left')).toBe(true);
    expect(preferredCardSideForStop(stops[0]!, entries)).not.toBe('left');
  });

  it('blocks bottom when only inbound comes from below', () => {
    const inbound = travel('tin', '2026-07-11T09:00:00.000Z', [
      { lat: 33.24, lng: -97.14 },
      { lat: 33.245, lng: -97.14 },
      { lat: 33.25, lng: -97.14 },
    ]);
    const shop = stay('s1', '2026-07-11T10:00:00.000Z', 33.25, -97.14, {
      placeKind: 'cache',
      poiId: 2,
      poiLabel: 'Victory Tap',
    });
    const entries = [inbound, shop];
    const stops = buildDayStoryStops([shop]);
    const blocked = blockedCardSidesForStop(stops[0]!, entries);
    expect(blocked.has('bottom')).toBe(true);
    expect(preferredCardSideForStop(stops[0]!, entries)).not.toBe('bottom');
  });

  it('blocks left and right when coming from left and going right', () => {
    const inbound = travel('tin', '2026-07-11T09:00:00.000Z', [
      { lat: 33.25, lng: -97.15 },
      { lat: 33.25, lng: -97.145 },
      { lat: 33.25, lng: -97.14 },
    ]);
    const shop = stay('s1', '2026-07-11T10:00:00.000Z', 33.25, -97.14, {
      placeKind: 'cache',
      poiId: 2,
      poiLabel: 'Shop',
    });
    const outbound = travel('tout', '2026-07-11T11:00:00.000Z', [
      { lat: 33.25, lng: -97.14 },
      { lat: 33.25, lng: -97.135 },
      { lat: 33.25, lng: -97.13 },
    ]);
    const entries = [inbound, shop, outbound];
    const stops = buildDayStoryStops([shop]);
    const blocked = blockedCardSidesForStop(stops[0]!, entries);
    expect(blocked.has('left')).toBe(true);
    expect(blocked.has('right')).toBe(true);
    const side = preferredCardSideForStop(stops[0]!, entries);
    expect(side === 'top' || side === 'bottom').toBe(true);
  });

  it('uses inbound travel for findInboundTravelForStay', () => {
    const homeStay = stay('h1', '2026-07-11T08:00:00.000Z', 33.23, -97.16, {
      placeKind: 'saved',
      placeId: 1,
    });
    const drive = travel('t1', '2026-07-11T09:00:00.000Z', [
      { lat: 33.2, lng: -97.16 },
      { lat: 33.21, lng: -97.16 },
      { lat: 33.22, lng: -97.16 },
    ]);
    const shop = stay('s1', '2026-07-11T10:00:00.000Z', 33.25, -97.14, {
      placeKind: 'cache',
      poiId: 2,
      poiLabel: 'Shop',
    });
    expect(findInboundTravelForStay([homeStay, drive, shop], shop.id)?.id).toBe(
      't1',
    );
  });

  it('marks diagonal neighbor with both facing sides', () => {
    const flower = stay('f4', '2026-07-11T13:00:00.000Z', 33.212, -96.797, {
      placeKind: 'cache',
      poiId: 4,
      poiLabel: 'Flower Child',
    });
    const victory = stay('v3', '2026-07-11T12:00:00.000Z', 33.21, -96.795, {
      placeKind: 'cache',
      poiId: 3,
      poiLabel: 'Victory Tap',
    });
    const stops = buildDayStoryStops([victory, flower]);
    const f = stops.find(s => s.label === 'Flower Child')!;
    const v = stops.find(s => s.label === 'Victory Tap')!;
    // Victory is SE of Flower → right + bottom
    expect(sidesTowardNeighbor(f, v).sort()).toEqual(['bottom', 'right']);
    // Flower is NW of Victory → left + top
    expect(sidesTowardNeighbor(v, f).sort()).toEqual(['left', 'top']);
  });

  it('pushes a close eastern neighbor card to the right', () => {
    const west = stay('w', '2026-07-11T10:00:00.000Z', 33.25, -97.14, {
      placeKind: 'cache',
      poiId: 1,
      poiLabel: 'West',
    });
    const east = stay('e', '2026-07-11T11:00:00.000Z', 33.25, -97.1395, {
      placeKind: 'cache',
      poiId: 2,
      poiLabel: 'East',
    });
    const stops = buildDayStoryStops([west, east]);
    const westStop = stops.find(s => s.label === 'West')!;
    const eastStop = stops.find(s => s.label === 'East')!;
    expect(sideAwayFromNeighbor(eastStop, westStop)).toBe('right');
    expect(sideAwayFromNeighbor(westStop, eastStop)).toBe('left');
  });

  it('pair packer puts west pin on left and east pin on right', () => {
    const victory = stay('v3', '2026-07-11T12:00:00.000Z', 33.21, -96.795, {
      placeKind: 'cache',
      poiId: 3,
      poiLabel: 'Victory Tap',
    });
    const flower = stay('f4', '2026-07-11T13:00:00.000Z', 33.2115, -96.797, {
      placeKind: 'cache',
      poiId: 4,
      poiLabel: 'Flower Child',
    });
    const stops = buildDayStoryStops([victory, flower]);
    const vStop = stops.find(s => s.label === 'Victory Tap')!;
    const fStop = stops.find(s => s.label === 'Flower Child')!;
    const { sideA, sideB } = bestPairSides(
      fStop,
      vStop,
      new Set(),
      new Set(),
    );
    expect(sideA).toBe('left');
    expect(sideB).toBe('right');
  });

  it('places 3/4 like the map: 4 left, 3 right or bottom', () => {
    // Geography from screenshot: Flower (4) NW, Victory (3) SE.
    // Chronology: Victory first, then drive NW to Flower.
    const victory = stay('v3', '2026-07-11T12:00:00.000Z', 33.21, -96.795, {
      placeKind: 'cache',
      poiId: 3,
      poiLabel: 'Victory Tap',
    });
    const flower = stay('f4', '2026-07-11T13:00:00.000Z', 33.212, -96.797, {
      placeKind: 'cache',
      poiId: 4,
      poiLabel: 'Flower Child',
    });
    // Into Victory from the west (from visit 2).
    const intoVictory = travel('t3', '2026-07-11T11:30:00.000Z', [
      { lat: 33.21, lng: -96.8 },
      { lat: 33.21, lng: -96.797 },
      { lat: 33.21, lng: -96.795 },
    ]);
    // Victory → Flower (SE → NW): south then... actually NW from victory.
    const victoryToFlower = travel('t34', '2026-07-11T12:30:00.000Z', [
      { lat: 33.21, lng: -96.795 },
      { lat: 33.211, lng: -96.796 },
      { lat: 33.212, lng: -96.797 },
    ]);
    const entries = [intoVictory, victory, victoryToFlower, flower];
    const stops = buildDayStoryStops([victory, flower]);
    const vStop = stops.find(s => s.label === 'Victory Tap')!;
    const fStop = stops.find(s => s.label === 'Flower Child')!;

    // 3: next pin (4) is NW → eliminate top+left; inbound from left → left.
    const elim3 = eliminatedCardSidesForStop({
      stop: vStop,
      previous: null,
      next: fStop,
      previousSide: null,
      entries,
    });
    expect(elim3.has('top')).toBe(true);
    expect(elim3.has('left')).toBe(true);

    // 4: prev pin (3) is SE → eliminate right+bottom; inbound from SE.
    const elim4 = eliminatedCardSidesForStop({
      stop: fStop,
      previous: vStop,
      next: null,
      previousSide: 'right',
      entries,
    });
    expect(elim4.has('right')).toBe(true);
    expect(elim4.has('bottom')).toBe(true);

    const sides = assignDayStoryCardSides(stops, entries, 700);
    const side3 = sides.get(vStop.key)!;
    const side4 = sides.get(fStop.key)!;

    // 3 → right or bottom; 4 → left (not right).
    expect(side3 === 'right' || side3 === 'bottom').toBe(true);
    expect(side4).toBe('left');
    expect(side4).not.toBe('right');
    expect(side3).not.toBe('top');
    expect(side3).not.toBe(side4);
  });

  it('never stacks two close sequential stops on the same side', () => {
    const a = stay('a', '2026-07-11T10:00:00.000Z', 33.25, -97.14, {
      placeKind: 'cache',
      poiId: 1,
      poiLabel: 'A',
    });
    const b = stay('b', '2026-07-11T11:00:00.000Z', 33.2501, -97.1398, {
      placeKind: 'cache',
      poiId: 2,
      poiLabel: 'B',
    });
    const stops = buildDayStoryStops([a, b]);
    const sides = assignDayStoryCardSides(stops, [a, b], 700);
    const sideA = sides.get(stops.find(s => s.label === 'A')!.key);
    const sideB = sides.get(stops.find(s => s.label === 'B')!.key);
    expect(sideA).not.toBe(sideB);
  });
});
