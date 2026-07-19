import { locationPointRow } from '@/lib/location-point-row';
import { buildTravelModeLegs } from '@/lib/travel-mode-legs';
import { splitTravelModeRuns } from '@lifemap/segmentation';

function pointAt(
  id: number,
  minutes: number,
  lat: number,
  lng: number,
  activityType: string | null,
  speed: number | null = 1,
) {
  return locationPointRow({
    id,
    timestamp: new Date(Date.UTC(2026, 6, 17, 12, 0, 0) + minutes * 60_000),
    lat,
    lng,
    speed,
    activityType,
    activityConfidence: 100,
  });
}

describe('buildTravelModeLegs', () => {
  it('keeps missing activity as a single solid leg', () => {
    const legs = buildTravelModeLegs([
      pointAt(1, 0, 33.2, -97.13, null),
      pointAt(2, 2, 33.21, -97.13, null),
      pointAt(3, 4, 33.22, -97.13, null),
    ]);
    expect(legs).toHaveLength(1);
    expect(legs[0]?.style).toBe('solid');
  });

  it('dashes a closed walk from last vehicle through foot until vehicle returns', () => {
    // Jul 17: #505295 vehicle → foot … #505569 on_foot → #505574 unknown idle
    // → #505577 vehicle. Dashed must end on #505569, not the still/unknown.
    const legs = buildTravelModeLegs([
      pointAt(505200, 10, 33.2165, -97.1348, 'in_vehicle', 8),
      pointAt(505295, 13, 33.2163, -97.1344, 'in_vehicle', 1.22),
      pointAt(505529, 15, 33.2158, -97.1338, 'on_foot', 1.36),
      pointAt(505554, 22, 33.2159, -97.1339, 'unknown', 0.04),
      pointAt(505559, 24, 33.2160, -97.1340, 'on_foot', 1.17),
      pointAt(505569, 27, 33.2163, -97.1345, 'on_foot', 0.21),
      pointAt(505574, 28, 33.2166, -97.1326, 'unknown', 0.05),
      pointAt(505577, 29, 33.2184, -97.1324, 'in_vehicle', 10.19),
      pointAt(505600, 30, 33.2170, -97.1330, 'in_vehicle', 12),
    ]);

    expect(legs.map(leg => leg.style)).toEqual(['solid', 'dashed', 'solid']);
    const walk = legs[1]!;
    expect(walk.style).toBe('dashed');
    expect(walk.coordinates[0]).toEqual({
      latitude: 33.2163,
      longitude: -97.1344,
    });
    expect(walk.coordinates[walk.coordinates.length - 1]).toEqual({
      latitude: 33.2163,
      longitude: -97.1345,
    });
  });

  it('dashes a walk that reaches the end of the drive (arrival on foot)', () => {
    const legs = buildTravelModeLegs([
      pointAt(1, 0, 33.2, -97.13, 'in_vehicle', 5),
      pointAt(2, 2, 33.201, -97.13, 'on_foot', 1),
      pointAt(3, 4, 33.202, -97.13, 'on_foot', 1),
      pointAt(4, 6, 33.203, -97.13, 'unknown', 0.1),
    ]);
    // Trailing unknown after last foot is solid, not dashed.
    expect(legs.map(leg => leg.style)).toEqual(['dashed', 'solid']);
    expect(legs[0]?.coordinates).toHaveLength(3);
  });

  it('closes a mid-drive walk when wheeled activity returns', () => {
    const legs = buildTravelModeLegs([
      pointAt(1, 0, 33.2, -97.13, 'in_vehicle', 5),
      pointAt(2, 1, 33.201, -97.13, 'on_foot', 1),
      pointAt(3, 2, 33.202, -97.13, 'on_bicycle', 4),
      pointAt(4, 3, 33.203, -97.13, 'in_vehicle', 8),
      pointAt(5, 4, 33.204, -97.13, 'in_vehicle', 9),
    ]);
    expect(legs.map(leg => leg.style)).toEqual(['dashed', 'solid']);
  });

  it('ends a walk on non-walking speed even without vehicle activity', () => {
    const runs = splitTravelModeRuns([
      pointAt(1, 0, 33.2, -97.13, 'in_vehicle', 4),
      pointAt(2, 1, 33.201, -97.13, 'on_foot', 1.2),
      pointAt(3, 2, 33.202, -97.13, 'unknown', 0.2),
      pointAt(4, 3, 33.203, -97.13, 'unknown', 8),
      pointAt(5, 4, 33.204, -97.13, 'unknown', 9),
    ]);
    expect(runs.map(run => run.style)).toEqual(['dashed', 'solid']);
    expect(runs[0]?.points.map(p => p.id)).toEqual([1, 2]);
    expect(runs[1]?.points.map(p => p.id)).toEqual([2, 3, 4, 5]);
  });

  it('dashes an entire on_foot travel (no vehicle points)', () => {
    const legs = buildTravelModeLegs([
      pointAt(1, 0, 33.25, -97.153, 'on_foot', 1.2),
      pointAt(2, 3, 33.249, -97.1525, 'on_foot', 0.9),
      pointAt(3, 6, 33.248, -97.1517, 'on_foot', 0.1),
      pointAt(4, 9, 33.249, -97.152, 'on_foot', 1.0),
      pointAt(5, 12, 33.25, -97.153, 'on_foot', 0.8),
    ]);
    expect(legs).toHaveLength(1);
    expect(legs[0]?.style).toBe('dashed');
    expect(legs[0]?.coordinates).toHaveLength(5);
  });

  it('never dashes when pathKind is stay', () => {
    const legs = buildTravelModeLegs(
      [
        pointAt(1, 0, 33.2, -97.13, 'in_vehicle', 4),
        pointAt(2, 1, 33.201, -97.13, 'on_foot', 1.2),
        pointAt(3, 2, 33.202, -97.13, 'on_foot', 1),
        pointAt(4, 3, 33.203, -97.13, 'in_vehicle', 8),
      ],
      { pathKind: 'stay' },
    );
    expect(legs).toHaveLength(1);
    expect(legs[0]?.style).toBe('solid');
    expect(legs[0]?.coordinates).toHaveLength(4);
  });
});
