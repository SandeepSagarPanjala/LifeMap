/** Stale-load guard shared by history-day-load and trip-materialization (no other deps). */

let globalLoadGeneration = 0;

export function bumpHistoryDayLoadGeneration(): number {
  globalLoadGeneration += 1;
  return globalLoadGeneration;
}

export function isCurrentHistoryDayLoad(generation: number): boolean {
  return generation === globalLoadGeneration;
}

/** @internal — reset between tests. */
export function resetHistoryLoadGenerationForTests(): void {
  globalLoadGeneration = 0;
}
