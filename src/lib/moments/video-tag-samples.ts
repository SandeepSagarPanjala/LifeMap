/**
 * Sample times for on-device video scene tagging.
 *
 * Early: 1s in. Middle: halfway. Late: start of the second-to-last second.
 * Times are clamped into the clip and unique-ified so short videos yield
 * fewer than three frames instead of duplicates.
 */
export function videoTagSampleTimesMs(durationMs: number): number[] {
  if (!Number.isFinite(durationMs) || durationMs <= 0) {
    return [0];
  }

  const maxMs = Math.max(0, Math.floor(durationMs));
  const candidates = [1000, Math.floor(durationMs / 2), durationMs - 2000];
  const unique = new Set<number>();

  for (const raw of candidates) {
    const clamped = Math.max(0, Math.min(maxMs, Math.floor(raw)));
    unique.add(clamped);
  }

  return [...unique].sort((a, b) => a - b);
}
