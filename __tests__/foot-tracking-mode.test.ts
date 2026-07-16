import type { Location } from 'react-native-background-geolocation';

import {
  isFootTrackingModeActive,
  resetFootTrackingMode,
  updateFootTrackingMode,
} from '@/lib/foot-tracking-mode';

function location(
  overrides: Partial<Location> & {
    activityType?: string;
    activityConfidence?: number;
    speed?: number | null;
    isMoving?: boolean;
    timestamp?: string;
  } = {},
): Location {
  return {
    timestamp: overrides.timestamp ?? '2026-07-15T22:40:00.000Z',
    is_moving: overrides.isMoving ?? true,
    coords: {
      latitude: 33.2,
      longitude: -97.13,
      accuracy: 10,
      altitude: 0,
      heading: 0,
      speed: overrides.speed ?? 1,
    },
    activity: {
      type: overrides.activityType ?? 'on_foot',
      confidence: overrides.activityConfidence ?? 100,
    },
    ...overrides,
  } as Location;
}

describe('updateFootTrackingMode', () => {
  beforeEach(() => {
    resetFootTrackingMode();
  });

  it('enters foot mode on confident on_foot', () => {
    expect(updateFootTrackingMode(location({ activityType: 'on_foot' }))).toBe(
      true,
    );
    expect(isFootTrackingModeActive()).toBe(true);
  });

  it('holds foot mode through unknown while still moving slowly', () => {
    updateFootTrackingMode(location({ activityType: 'on_foot' }));
    expect(
      updateFootTrackingMode(
        location({
          activityType: 'unknown',
          activityConfidence: 33,
          timestamp: '2026-07-15T22:41:00.000Z',
          speed: 1.2,
          isMoving: true,
        }),
      ),
    ).toBe(true);
  });

  it('exits foot mode on confident in_vehicle', () => {
    updateFootTrackingMode(location({ activityType: 'on_foot' }));
    expect(
      updateFootTrackingMode(
        location({
          activityType: 'in_vehicle',
          activityConfidence: 100,
          timestamp: '2026-07-15T22:42:00.000Z',
          speed: 12,
        }),
      ),
    ).toBe(false);
    expect(isFootTrackingModeActive()).toBe(false);
  });
});
