import { shouldRefreshUserCoordinate } from '../src/lib/user-coordinate-throttle';
import {
  USER_COORDINATE_MIN_INTERVAL_MS,
  USER_COORDINATE_MIN_MOVE_METERS,
} from '../src/lib/app-constants';

const home = { latitude: 33.21, longitude: -97.13 };

describe('shouldRefreshUserCoordinate', () => {
  it('always refreshes the first coordinate', () => {
    expect(shouldRefreshUserCoordinate(null, home, 0, 0)).toBe(true);
  });

  it('skips tiny moves inside the throttle window', () => {
    const next = { latitude: 33.21001, longitude: -97.13001 };
    expect(
      shouldRefreshUserCoordinate(
        home,
        next,
        1_000,
        1_000 + USER_COORDINATE_MIN_INTERVAL_MS - 1,
      ),
    ).toBe(false);
  });

  it('refreshes after the throttle window', () => {
    expect(
      shouldRefreshUserCoordinate(
        home,
        home,
        0,
        USER_COORDINATE_MIN_INTERVAL_MS,
      ),
    ).toBe(true);
  });

  it('refreshes on a large move even inside the window', () => {
    const far = { latitude: 33.22, longitude: -97.13 };
    expect(shouldRefreshUserCoordinate(home, far, 1_000, 2_000)).toBe(true);
    expect(USER_COORDINATE_MIN_MOVE_METERS).toBeGreaterThan(0);
  });
});
