import {
  HEALTHKIT_BACKFILL_LOOKBACK_DAYS,
  HEALTHKIT_ROUTINE_LOOKBACK_DAYS,
} from './types';

const DAY_MS = 24 * 60 * 60_000;

/**
 * Window a routine (foreground / observer) sync should read.
 *
 * Normally 2 days, which covers today plus Apple Watch samples that landed
 * late. When LifeMap has not synced for a while the window grows to cover the
 * gap, so skipping the app for a week still backfills those days on next open.
 */
export function resolveRoutineLookbackDays(
  lastSyncAt: Date | null,
  now: Date = new Date(),
): number {
  if (lastSyncAt == null) {
    return HEALTHKIT_BACKFILL_LOOKBACK_DAYS;
  }
  const elapsedMs = now.getTime() - lastSyncAt.getTime();
  if (!Number.isFinite(elapsedMs)) {
    return HEALTHKIT_ROUTINE_LOOKBACK_DAYS;
  }
  const elapsedDays = Math.ceil(elapsedMs / DAY_MS);
  return Math.min(
    HEALTHKIT_BACKFILL_LOOKBACK_DAYS,
    Math.max(HEALTHKIT_ROUTINE_LOOKBACK_DAYS, elapsedDays + 1),
  );
}
