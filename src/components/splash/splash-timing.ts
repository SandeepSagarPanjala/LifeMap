/** Subtitle fade/rise finishes at delay + duration. */
export const SPLASH_SUBTITLE_INTRO_END_MS = 1100 + 650;

/** Pause after title, underline, and subtitle finish. */
export const SPLASH_HOLD_AFTER_INTRO_MS = 1250;

export const SPLASH_NORMAL_TOTAL_MS = 3000;

export const SPLASH_SLOW_TOTAL_MS = 45000;

export function getSplashNavigateAtMs(slowSplash: boolean): number {
  return slowSplash ? SPLASH_SLOW_TOTAL_MS : SPLASH_NORMAL_TOTAL_MS;
}
