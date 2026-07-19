import {
  DEFAULT_STOP_CONFIG,
  isMovingPoint,
  type ParsedPoint,
} from '@lifemap/segmentation';

function point(
  overrides: Partial<ParsedPoint> & Pick<ParsedPoint, 'id' | 'at'>,
): ParsedPoint {
  const at = overrides.at;
  return {
    lat: 33.2,
    lng: -97.13,
    accuracy: 10,
    altitude: null,
    speed: null,
    source: 'gps',
    timestamp: at,
    activityType: null,
    activityConfidence: null,
    isMoving: null,
    dateKey: '2026-07-15',
    ...overrides,
  };
}

describe('isMovingPoint without foot detection', () => {
  it('ignores confident on_foot below moving speed', () => {
    expect(
      isMovingPoint(
        point({
          id: 1,
          at: new Date('2026-07-15T10:00:00Z'),
          activityType: 'on_foot',
          activityConfidence: 100,
          isMoving: true,
          speed: 0.5,
        }),
        DEFAULT_STOP_CONFIG,
      ),
    ).toBe(false);
  });

  it('still treats in_vehicle as moving', () => {
    expect(
      isMovingPoint(
        point({
          id: 1,
          at: new Date('2026-07-15T10:00:00Z'),
          activityType: 'in_vehicle',
          activityConfidence: 100,
          isMoving: true,
        }),
        DEFAULT_STOP_CONFIG,
      ),
    ).toBe(true);
  });
});
