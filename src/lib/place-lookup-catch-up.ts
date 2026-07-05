import {
  PLACE_LOOKUP_CATCH_UP_BATCH_MAX,
  PLACE_LOOKUP_CATCH_UP_DELAY_MS,
  PLACE_LOOKUP_CATCH_UP_STRIP_THRESHOLD,
  DEFAULT_IDLE_TIMEOUT_MS,
} from '@/lib/app-constants';
import {
  countUnlabeledStayTrips,
  listUnlabeledStayTrips,
} from '@/db/repositories/trips';
import {listSavedPlaces} from '@/db/repositories/saved-places';
import {
  listStaysNeedingPlaceLookup,
  tripRowToBackfillStay,
} from '@/lib/place-lookup-backfill';
import {resolveAndPersistPlaceLabelForTripRow} from '@/lib/place-lookup-resolve';
import {
  clearPlaceLookupCatchUpProgress,
  setPlaceLookupCatchUpProgress,
} from '@/lib/place-lookup-catch-up-events';
import {runWhenIdle, yieldToEventLoop} from '@/lib/run-when-idle';
import {
  existingTripLabelsByEventKey,
  getDefaultTripDetectionConfig,
} from '@/lib/trip-materialization';

let running = false;
let abortRequested = false;

export function abortPlaceLookupCatchUp(): void {
  abortRequested = true;
}

export function isPlaceLookupCatchUpRunning(): boolean {
  return running;
}

async function runPlaceLookupCatchUpBatch(
  unlabeledCount: number,
): Promise<void> {
  const showStrip = unlabeledCount >= PLACE_LOOKUP_CATCH_UP_STRIP_THRESHOLD;
  const batchSize = Math.min(unlabeledCount, PLACE_LOOKUP_CATCH_UP_BATCH_MAX);
  const config = getDefaultTripDetectionConfig();
  const savedPlaces = await listSavedPlaces();
  const rows = await listUnlabeledStayTrips(batchSize);
  const trips = listStaysNeedingPlaceLookup(rows, config, savedPlaces);
  if (trips.length === 0) {
    return;
  }

  const existingByEventKey = existingTripLabelsByEventKey(trips);
  let completed = 0;

  setPlaceLookupCatchUpProgress({
    phase: 'running',
    total: trips.length,
    completed,
    showStrip,
    message: 'Labeling places…',
  });

  for (const trip of trips) {
    if (abortRequested) {
      setPlaceLookupCatchUpProgress({
        phase: 'aborted',
        total: trips.length,
        completed,
        showStrip,
        message: 'Place labeling stopped',
      });
      return;
    }

    const stay = tripRowToBackfillStay(trip);
    const addressHint = stay.placeLabel?.trim();
    setPlaceLookupCatchUpProgress({
      phase: 'running',
      total: trips.length,
      completed,
      showStrip,
      message:
        addressHint != null && addressHint.length > 0
          ? `Labeling ${addressHint}`
          : 'Labeling places…',
    });

    await resolveAndPersistPlaceLabelForTripRow(trip, {
      config,
      savedPlaces,
      existingByEventKey,
      bypassSessionBudget: true,
    });

    completed += 1;
    setPlaceLookupCatchUpProgress({
      phase: 'running',
      total: trips.length,
      completed,
      showStrip,
      message: 'Labeling places…',
    });

    await yieldToEventLoop();
    if (PLACE_LOOKUP_CATCH_UP_DELAY_MS > 0) {
      await new Promise(resolve =>
        setTimeout(resolve, PLACE_LOOKUP_CATCH_UP_DELAY_MS),
      );
    }
  }

  setPlaceLookupCatchUpProgress({
    phase: 'done',
    total: trips.length,
    completed,
    showStrip,
    message: null,
  });
}

/**
 * Foreground catch-up for unlabeled sealed stays.
 * Call after sealYesterdayIfNeeded and yieldToEventLoop — not on the same tick as map mount.
 */
export function startPlaceLookupCatchUp(): void {
  void (async () => {
    if (running) {
      return;
    }

    const unlabeledCount = await countUnlabeledStayTrips();
    if (unlabeledCount === 0) {
      return;
    }

    running = true;
    abortRequested = false;

    const finish = () => {
      running = false;
      setTimeout(() => clearPlaceLookupCatchUpProgress(), 800);
    };

    const launch = () =>
      runPlaceLookupCatchUpBatch(unlabeledCount)
        .catch(() => undefined)
        .finally(finish);

    if (unlabeledCount >= PLACE_LOOKUP_CATCH_UP_STRIP_THRESHOLD) {
      runWhenIdle(() => {
        void launch();
      }, DEFAULT_IDLE_TIMEOUT_MS);
    } else {
      await launch();
    }
  })();
}
