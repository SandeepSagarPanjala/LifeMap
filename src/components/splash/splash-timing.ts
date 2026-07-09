import { SPLASH_MAX_MS, SPLASH_MIN_MS } from '@/lib/app-constants';

export function splashAnimationDurationMs(elapsedMs: number): number {
  return Math.min(SPLASH_MAX_MS, Math.max(SPLASH_MIN_MS, elapsedMs));
}
