/** Matches drizzle sqlite `integer({ mode: 'timestamp' })` storage. */
export function locationPointTimestampToStorageValue(date: Date): number {
  return Math.floor(date.getTime() / 1000);
}

/**
 * Coerce a value from SQL aggregates / raw reads into a Date.
 * Storage is unix **seconds**; raw `min()`/`max()` often returns a number
 * that must not be passed straight into `new Date(ms)`.
 */
export function locationPointTimestampFromStorageValue(
  value: unknown,
): Date | null {
  if (value == null) {
    return null;
  }
  if (value instanceof Date) {
    const ms = value.getTime();
    return Number.isFinite(ms) ? value : null;
  }
  const numeric =
    typeof value === 'number'
      ? value
      : typeof value === 'string'
        ? Number(value)
        : NaN;
  if (!Number.isFinite(numeric)) {
    return null;
  }
  // Seconds vs ms: unix seconds for 2001+ are < 1e12; ms are larger.
  const ms = numeric < 1e12 ? numeric * 1000 : numeric;
  const date = new Date(ms);
  return Number.isFinite(date.getTime()) ? date : null;
}
