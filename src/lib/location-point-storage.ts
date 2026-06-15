/** Matches drizzle sqlite `integer({ mode: 'timestamp' })` storage. */
export function locationPointTimestampToStorageValue(date: Date): number {
  return Math.floor(date.getTime() / 1000);
}
