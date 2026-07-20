import {
  buildArrowChevron,
  destinationPoint,
  routeDirectionArrowSizeForZoom,
  sampleRouteDirectionArrows,
} from '../src/lib/route-direction-arrows';
import type { MapCoordinate } from '../src/lib/location-geo';

/** ~111 m north per 0.001° latitude. */
function northPath(steps: number, stepDeg = 0.001): MapCoordinate[] {
  const coords: MapCoordinate[] = [];
  for (let i = 0; i <= steps; i += 1) {
    coords.push({ latitude: 33.2 + i * stepDeg, longitude: -97.13 });
  }
  return coords;
}

describe('buildArrowChevron', () => {
  it('points the tip north for bearing 0', () => {
    const center = { latitude: 33.2, longitude: -97.13 };
    const { shaft, chevron } = buildArrowChevron(center, 0, 10);
    const tip = chevron[1]!;
    expect(tip.latitude).toBeGreaterThan(center.latitude);
    expect(shaft[0]!.latitude).toBeLessThan(tip.latitude);
    expect(chevron[0]!.latitude).toBeLessThan(tip.latitude);
    expect(chevron[2]!.latitude).toBeLessThan(tip.latitude);
  });

  it('points the tip east for bearing 90', () => {
    const center = { latitude: 33.2, longitude: -97.13 };
    const tip = buildArrowChevron(center, 90, 10).chevron[1]!;
    expect(tip.longitude).toBeGreaterThan(center.longitude);
  });
});

describe('routeDirectionArrowSizeForZoom', () => {
  it('shrinks ground size when zooming in so on-screen size stays stable', () => {
    const atRef = routeDirectionArrowSizeForZoom(0.02);
    const closer = routeDirectionArrowSizeForZoom(0.01);
    expect(closer).toBeLessThan(atRef);
    expect(closer).toBeCloseTo(atRef / 2, 5);
  });

  it('keeps scaling when zoomed out past the old gate', () => {
    const atRef = routeDirectionArrowSizeForZoom(0.02);
    const farther = routeDirectionArrowSizeForZoom(0.08);
    expect(farther).toBeGreaterThan(atRef);
  });

  it('clamps far-out zoom so arrows do not grow without bound', () => {
    const atClamp = routeDirectionArrowSizeForZoom(0.35);
    const wayOut = routeDirectionArrowSizeForZoom(0.5);
    expect(wayOut).toBeCloseTo(atClamp, 5);
  });
});

describe('destinationPoint', () => {
  it('moves north when bearing is 0', () => {
    const origin = { latitude: 33.2, longitude: -97.13 };
    const north = destinationPoint(origin, 0, 100);
    expect(north.latitude).toBeGreaterThan(origin.latitude);
    expect(north.longitude).toBeCloseTo(origin.longitude, 4);
  });
});

describe('sampleRouteDirectionArrows', () => {
  it('returns no arrows for short / jitter paths', () => {
    const short: MapCoordinate[] = [
      { latitude: 33.2, longitude: -97.13 },
      { latitude: 33.2001, longitude: -97.13 },
    ];
    expect(sampleRouteDirectionArrows(short)).toEqual([]);
  });

  it('returns no arrows for a single coordinate', () => {
    expect(
      sampleRouteDirectionArrows([{ latitude: 33.2, longitude: -97.13 }]),
    ).toEqual([]);
  });

  it('places arrows heading north along a long northbound path', () => {
    const arrows = sampleRouteDirectionArrows(northPath(10), {
      spacingM: 150,
      minPathM: 40,
      maxArrows: 12,
    });
    expect(arrows.length).toBeGreaterThanOrEqual(2);
    expect(arrows.length).toBeLessThanOrEqual(12);
    for (const arrow of arrows) {
      expect(arrow.bearing).toBeCloseTo(0, 0);
      expect(arrow.coordinate.longitude).toBeCloseTo(-97.13, 5);
      expect(arrow.chevron).toHaveLength(3);
      expect(arrow.shaft).toHaveLength(2);
      expect(arrow.chevron[1]!.latitude).toBeGreaterThan(
        arrow.coordinate.latitude,
      );
    }
  });

  it('respects perfMax safety ceiling', () => {
    const arrows = sampleRouteDirectionArrows(northPath(20), {
      spacingM: 50,
      perfMax: 3,
    });
    expect(arrows).toHaveLength(3);
  });

  it('spreads arrows across the full path instead of only the start', () => {
    const arrows = sampleRouteDirectionArrows(northPath(20), {
      spacingM: 70,
      perfMax: 12,
    });
    expect(arrows.length).toBeGreaterThanOrEqual(8);
    const firstLat = arrows[0]!.coordinate.latitude;
    const lastLat = arrows[arrows.length - 1]!.coordinate.latitude;
    expect(lastLat).toBeGreaterThan(33.2 + 0.01);
    expect(lastLat).toBeGreaterThan(firstLat);
  });

  it('grows with path length past the old design cap of 24', () => {
    const arrows = sampleRouteDirectionArrows(northPath(40), {
      spacingM: 80,
    });
    // ~4.4 km / 80 m ≈ 55 arrows if uncapped at 24
    expect(arrows.length).toBeGreaterThan(24);
  });

  it('skips unstable tiny segments for placement but continues the path', () => {
    const coords: MapCoordinate[] = [
      { latitude: 33.2, longitude: -97.13 },
      { latitude: 33.20001, longitude: -97.13 },
      { latitude: 33.205, longitude: -97.13 },
    ];
    const arrows = sampleRouteDirectionArrows(coords, {
      spacingM: 200,
      minPathM: 40,
      minSegmentM: 8,
      maxArrows: 5,
    });
    expect(arrows.length).toBeGreaterThanOrEqual(1);
    for (const arrow of arrows) {
      expect(arrow.bearing).toBeCloseTo(0, 0);
    }
  });
});
