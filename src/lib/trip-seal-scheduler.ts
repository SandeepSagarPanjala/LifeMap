import {getCurrentTripDetectionConfig} from '@/lib/trip-detection-config';
import {getTodayDateKey} from '@/lib/day-utils';
import {
  isClosedPlayableEntry,
  persistClosedTripsIncremental,
} from '@/lib/trip-materialization';

const SEAL_DEBOUNCE_MS = 8_000;
let sealTimer: ReturnType<typeof setTimeout> | null = null;
let sealInFlight = false;

/** Debounced — seal newly closed trips after GPS saves without blocking tracking. */
export function scheduleSealTodayTripsAfterGps(): void {
  if (sealTimer != null) {
    clearTimeout(sealTimer);
  }
  sealTimer = setTimeout(() => {
    sealTimer = null;
    void runSealTodayTripsAfterGps();
  }, SEAL_DEBOUNCE_MS);
}

async function runSealTodayTripsAfterGps(): Promise<void> {
  if (sealInFlight) {
    return;
  }
  sealInFlight = true;
  try {
    const dateKey = getTodayDateKey();
    const detectionConfig = getCurrentTripDetectionConfig();
    const {loadTodayHistoryMerged} = await import('@/lib/trip-materialization');
    const history = await loadTodayHistoryMerged(detectionConfig, new Date());
    const closedEntries = history.entries.filter(isClosedPlayableEntry);
    await persistClosedTripsIncremental(dateKey, detectionConfig, closedEntries, {
      fullReplace: false,
      pointCount: history.points.length,
    });
  } finally {
    sealInFlight = false;
  }
}
