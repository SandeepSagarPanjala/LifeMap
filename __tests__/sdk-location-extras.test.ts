import { sdkLocationExtras } from '@/lib/sdk-location-extras';
import type { Location } from 'react-native-background-geolocation';

function makeLocation(
  overrides: {
    coords?: Partial<Location['coords']>;
    activity?: Partial<Location['activity']>;
    battery?: Partial<Location['battery']>;
    is_moving?: boolean;
    mock?: boolean;
    uuid?: string;
  } = {},
): Location {
  return {
    timestamp: '2026-07-13T12:00:00.000Z',
    recorded_at: '2026-07-13T12:00:00.000Z',
    age: 0,
    odometer: 12,
    odometer_error: 0,
    is_moving: overrides.is_moving ?? true,
    uuid: overrides.uuid ?? 'abc-123',
    mock: overrides.mock ?? false,
    coords: {
      latitude: 33.2,
      longitude: -97.1,
      accuracy: 8,
      altitude: 200,
      heading: 90,
      heading_accuracy: 5,
      speed: 4.5,
      speed_accuracy: 0.4,
      altitude_accuracy: 3,
      ...overrides.coords,
    },
    activity: {
      type: 'in_vehicle',
      confidence: 85,
      ...overrides.activity,
    },
    battery: {
      is_charging: true,
      level: 0.72,
      ...overrides.battery,
    },
  } as Location;
}

describe('sdkLocationExtras', () => {
  it('maps activity, heading, motion, mock, uuid, and battery', () => {
    expect(sdkLocationExtras(makeLocation())).toEqual({
      heading: 90,
      headingAccuracy: 5,
      speedAccuracy: 0.4,
      altitudeAccuracy: 3,
      activityType: 'in_vehicle',
      activityConfidence: 85,
      isMoving: true,
      isMock: false,
      uuid: 'abc-123',
      batteryLevel: 0.72,
      batteryIsCharging: true,
    });
  });

  it('nulls invalid negative accuracy and heading values', () => {
    expect(
      sdkLocationExtras(
        makeLocation({
          coords: {
            heading: -1,
            heading_accuracy: -1,
            speed_accuracy: -1,
            altitude_accuracy: -1,
          },
          battery: { level: -1, is_charging: false },
        }),
      ),
    ).toMatchObject({
      heading: null,
      headingAccuracy: null,
      speedAccuracy: null,
      altitudeAccuracy: null,
      batteryLevel: null,
      batteryIsCharging: false,
    });
  });
});
