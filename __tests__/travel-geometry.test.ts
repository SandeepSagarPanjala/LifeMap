import type { LocationPointRow } from '@/db/repositories/location-days';
import {
  canonicalizeTravelGeometry,
  canonicalizeTravelGeometryForPersist,
  DRIVE_MIN_POINTS_TO_SIMPLIFY,
  findTurnAnchorIndices,
} from '@/lib/travel-geometry';
import { makeMoment } from './helpers/fixtures';

function point(
  id: number,
  iso: string,
  lat: number,
  lng: number,
): LocationPointRow {
  return {
    id,
    timestamp: new Date(iso),
    lat,
    lng,
    accuracy: 10,
    altitude: null,
    speed: 20,
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

describe('canonicalizeTravelGeometry', () => {
  it('keeps short drives unchanged', () => {
    const points = Array.from({ length: 10 }, (_, index) =>
      point(
        index + 1,
        `2026-06-17T10:0${index}:00.000Z`,
        33.2 + index * 0.0001,
        -97.13,
      ),
    );
    expect(canonicalizeTravelGeometry(points).length).toBe(10);
  });

  it('reduces a long straight highway segment', () => {
    const points: LocationPointRow[] = [];
    for (let i = 0; i < 120; i += 1) {
      points.push(
        point(
          i + 1,
          `2026-06-17T10:${String(i).padStart(2, '0')}:00.000Z`,
          33.2 + i * 0.001,
          -97.13,
        ),
      );
    }
    const simplified = canonicalizeTravelGeometry(points);
    expect(simplified.length).toBeLessThan(points.length / 2);
    expect(simplified[0]?.id).toBe(1);
    expect(simplified[simplified.length - 1]?.id).toBe(120);
  });

  it('preserves a sharp turn anchor', () => {
    const straight: LocationPointRow[] = [];
    for (let i = 0; i < DRIVE_MIN_POINTS_TO_SIMPLIFY; i += 1) {
      straight.push(
        point(
          i + 1,
          `2026-06-17T10:00:${String(i).padStart(2, '0')}.000Z`,
          33.2,
          -97.13 + i * 0.0001,
        ),
      );
    }
    const turn = point(40, '2026-06-17T10:01:00.000Z', 33.205, -97.12);
    const after: LocationPointRow[] = [];
    for (let i = 0; i < 20; i += 1) {
      after.push(
        point(
          41 + i,
          `2026-06-17T10:02:${String(i).padStart(2, '0')}.000Z`,
          33.205 + i * 0.0001,
          -97.11,
        ),
      );
    }
    const points = [...straight, turn, ...after];
    const anchors = findTurnAnchorIndices(points);
    expect(anchors.length).toBeGreaterThan(0);
    const simplified = canonicalizeTravelGeometry(points);
    expect(simplified.some(p => p.id === turn.id)).toBe(true);
  });
});

function momentRow(id: number, iso: string) {
  return makeMoment({ id, timestamp: new Date(iso), type: 'note' });
}

describe('canonicalizeTravelGeometryForPersist', () => {
  it('forces a moment anchor onto the simplified route', () => {
    const points: LocationPointRow[] = [];
    for (let i = 0; i < 120; i += 1) {
      const minutes = Math.floor(i / 60);
      const seconds = (i % 60) * 1;
      points.push(
        point(
          i + 1,
          `2026-06-17T10:${String(minutes).padStart(2, '0')}:${String(
            seconds,
          ).padStart(2, '0')}.000Z`,
          33.2 + i * 0.001,
          -97.13,
        ),
      );
    }
    const startAt = points[0]!.timestamp;
    const endAt = points[points.length - 1]!.timestamp;
    const anchorMoment = momentRow(7, points[60]!.timestamp.toISOString());
    const persisted = canonicalizeTravelGeometryForPersist(
      points,
      [anchorMoment],
      startAt,
      endAt,
    );
    expect(persisted.some(row => row.momentId === 7)).toBe(true);
    expect(persisted.length).toBeLessThan(points.length);
  });
});
