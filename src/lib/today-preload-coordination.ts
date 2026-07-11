/**
 * Cold-start coordination: preload marks today's cache key after a successful warm;
 * the map hook skips redundant mount syncs while the mark matches this open cycle.
 *
 * Not time-based — cleared only in beginTodayOpenCycle(), not on first skip.
 */

let preloadedCacheKeyForMountSkip: string | null = null;

export function resetTodayPreloadMountSkip(): void {
  preloadedCacheKeyForMountSkip = null;
}

export function markTodayPreloadedForMountSkip(cacheKey: string): void {
  preloadedCacheKeyForMountSkip = cacheKey;
}

/**
 * True while preload warmed this cache key for the current open cycle.
 * Callers must still verify the cache slot is present — skip only avoids a
 * duplicate sync when today is still warm, not when it was evicted.
 */
export function shouldSkipTodayPreloadMountSync(cacheKey: string): boolean {
  return (
    preloadedCacheKeyForMountSkip != null &&
    preloadedCacheKeyForMountSkip === cacheKey
  );
}

/** @internal — reset between tests. */
export function resetTodayPreloadMountSkipForTests(): void {
  resetTodayPreloadMountSkip();
}
