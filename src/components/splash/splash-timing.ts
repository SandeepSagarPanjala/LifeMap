/** Minimum time so the underline animation is visible even when the DB opens instantly. */
export const SPLASH_MIN_MS = 400;

/** Safety cap — never block launch longer than this on a stuck migration. */
export const SPLASH_MAX_MS = 8_000;

export function splashAnimationDurationMs(elapsedMs: number): number {
  return Math.min(SPLASH_MAX_MS, Math.max(SPLASH_MIN_MS, elapsedMs));
}
