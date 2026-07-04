import {splashAnimationDurationMs} from '@/components/splash/splash-timing';
import {SPLASH_MAX_MS, SPLASH_MIN_MS} from '@/lib/app-constants';

describe('splashAnimationDurationMs', () => {
  it('enforces a minimum visible duration', () => {
    expect(splashAnimationDurationMs(50)).toBe(SPLASH_MIN_MS);
  });

  it('matches elapsed time when above the minimum', () => {
    expect(splashAnimationDurationMs(1200)).toBe(1200);
  });

  it('caps extremely long waits', () => {
    expect(splashAnimationDurationMs(20_000)).toBe(SPLASH_MAX_MS);
  });
});
