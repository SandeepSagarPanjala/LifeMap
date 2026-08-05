import { subDays } from 'date-fns';

import {
  createActivity,
  listActiveActivities,
  type ActivityRow,
} from '@/db/repositories/activities';
import {
  getHealthWorkoutByUuid,
  upsertDaySleep,
  upsertDaySteps,
  upsertHealthWorkout,
  upsertSleepSample,
  upsertSleepSession,
} from '@/db/repositories/health';
import { insertMoment } from '@/db/repositories/moments';
import {
  serializeActivityValuesJson,
  type ActivityFieldDefinition,
} from '@/lib/activities/activity-definition';
import { getDayRange, shiftDateKey, toDateKey } from '@/lib/day-utils';

import { buildDaySleepRollups } from './day-sleep';
import { notifyHealthDataUpdated } from './events';
import { resolveRoutineLookbackDays } from './lookback';
import { coalesceSleepSessions, isAsleepSleepValue } from './sleep-math';
import {
  getHealthKitActivityEnabled,
  getHealthKitLastSyncAt,
  getHealthKitMasterEnabled,
  getHealthKitSleepEnabled,
  getHealthKitStepsEnabled,
  getHealthKitSyncOnChangesEnabled,
  getHealthKitSyncOnDetailOpenEnabled,
  setHealthKitLastSyncAt,
} from './settings';
import { isHealthDataAvailableSafe, isHealthKitSupported } from './permissions';
import { HEALTHKIT_IMPORT_SOURCE } from './types';
import { workoutMetaForType } from './workout-labels';

const DURATION_FIELD: ActivityFieldDefinition = {
  id: 'duration',
  type: 'duration',
  label: 'Duration',
  required: false,
};

export type HealthSyncPhase =
  | 'preparing'
  | 'sleep'
  | 'steps'
  | 'workouts'
  | 'done';

export type HealthSyncProgress = {
  phase: HealthSyncPhase;
  message: string;
  /** Overall 0–100; never moves backward within a sync. */
  percent: number;
  completed?: number;
  total?: number;
};

export type HealthSyncProgressCallback = (progress: HealthSyncProgress) => void;

type SyncOptions = {
  onProgress?: HealthSyncProgressCallback;
  /** Omit for the routine window; pass a value for an explicit backfill. */
  lookbackDays?: number;
};

let syncInFlight: Promise<void> | null = null;
let syncInFlightLookbackDays = 0;
let bootstrapped = false;

function quantityValue(
  q: { quantity?: number; unit?: string } | undefined,
): number | null {
  if (
    q == null ||
    typeof q.quantity !== 'number' ||
    !Number.isFinite(q.quantity)
  ) {
    return null;
  }
  return q.quantity;
}

function countDateKeysInclusive(fromKey: string, toKey: string): number {
  let count = 1;
  let key = fromKey;
  while (key !== toKey) {
    key = shiftDateKey(key, 1);
    count += 1;
    if (count > 400) {
      break;
    }
  }
  return count;
}

type PhaseKind = 'sleep' | 'steps' | 'workouts';

function phasePercent(
  phaseIndex: number,
  phaseCount: number,
  completed: number,
  total: number,
): number {
  if (phaseCount <= 0) {
    return 100;
  }
  const prepEnd = 3;
  const span = 95 / phaseCount;
  const start = prepEnd + phaseIndex * span;
  const end = prepEnd + (phaseIndex + 1) * span;
  if (total <= 0) {
    return Math.round(end);
  }
  const t = Math.min(1, Math.max(0, completed / total));
  return Math.round(start + (end - start) * t);
}

async function findOrCreateHealthActivity(
  cache: ActivityRow[],
  emoji: string,
  label: string,
  activityType: number,
): Promise<ActivityRow> {
  const templateId = `healthkit:workout:${activityType}`;
  const match = cache.find(
    a =>
      a.templateId === templateId ||
      (a.source === 'healthkit' && a.label === label),
  );
  if (match) {
    return match;
  }
  const created = await createActivity({
    emoji,
    label,
    fields: [DURATION_FIELD],
    source: 'healthkit',
    templateId,
  });
  cache.push(created);
  return created;
}

async function syncSleep(
  from: Date,
  to: Date,
  report: (completed: number, total: number, message: string) => void,
): Promise<void> {
  const { queryCategorySamples } =
    require('@kingstinct/react-native-healthkit') as typeof import('@kingstinct/react-native-healthkit');

  report(0, 1, 'Reading sleep…');

  const samples = await queryCategorySamples(
    'HKCategoryTypeIdentifierSleepAnalysis',
    {
      limit: 0,
      ascending: true,
      filter: {
        date: {
          startDate: from,
          endDate: to,
        },
      },
    },
  );

  const mapped = samples.map(s => ({
    uuid: s.uuid,
    startAt: s.startDate,
    endAt: s.endDate,
    value: Number(s.value),
  }));

  // Persist asleep + awake samples (skip inBed-only for stage math).
  const persistable = mapped.filter(
    s => isAsleepSleepValue(s.value) || s.value === 2,
  );
  const coalesced = coalesceSleepSessions(mapped);

  const total = Math.max(1, persistable.length + coalesced.length);
  if (persistable.length === 0 && coalesced.length === 0) {
    report(1, 1, 'No sleep sessions in range');
    return;
  }

  let completed = 0;
  for (const sample of persistable) {
    await upsertSleepSample(sample);
    completed += 1;
    report(completed, total, `Saving sleep ${completed} of ${total}`);
  }

  for (const session of coalesced) {
    await upsertSleepSession({
      uuid: session.uuid,
      startAt: session.startAt,
      endAt: session.endAt,
    });
    completed += 1;
    report(completed, total, `Saving sleep ${completed} of ${total}`);
  }

  const rollups = buildDaySleepRollups(mapped);
  for (const rollup of rollups) {
    await upsertDaySleep(rollup);
  }
}

async function syncSteps(
  fromDateKey: string,
  toDateKey: string,
  report: (completed: number, total: number, message: string) => void,
): Promise<void> {
  const { queryStatisticsForQuantity } =
    require('@kingstinct/react-native-healthkit') as typeof import('@kingstinct/react-native-healthkit');

  const totalDays = countDateKeysInclusive(fromDateKey, toDateKey);
  let key = fromDateKey;
  let dayIndex = 0;
  for (;;) {
    dayIndex += 1;
    const { start, end } = getDayRange(key);
    try {
      const stats = await queryStatisticsForQuantity(
        'HKQuantityTypeIdentifierStepCount',
        ['cumulativeSum'],
        {
          filter: {
            date: {
              startDate: start,
              endDate: end,
            },
          },
        },
      );
      const steps = Math.round(quantityValue(stats.sumQuantity) ?? 0);
      if (steps > 0) {
        await upsertDaySteps(key, steps);
      }
    } catch {
      // Non-fatal per day
    }
    report(dayIndex, totalDays, `Steps · day ${dayIndex} of ${totalDays}`);
    if (key === toDateKey) {
      break;
    }
    key = shiftDateKey(key, 1);
  }
}

async function syncWorkouts(
  from: Date,
  to: Date,
  report: (completed: number, total: number, message: string) => void,
): Promise<void> {
  const { queryWorkoutSamples } =
    require('@kingstinct/react-native-healthkit') as typeof import('@kingstinct/react-native-healthkit');

  report(0, 1, 'Reading workouts…');

  const workouts = await queryWorkoutSamples({
    limit: 0,
    ascending: true,
    filter: {
      date: {
        startDate: from,
        endDate: to,
      },
    },
  });

  const total = Math.max(1, workouts.length);
  if (workouts.length === 0) {
    report(1, 1, 'No workouts in range');
    return;
  }

  const activityCache = await listActiveActivities();
  let completed = 0;
  for (const workout of workouts) {
    const activityType = Number(workout.workoutActivityType);
    const meta = workoutMetaForType(activityType);
    const durationSec =
      quantityValue(workout.duration) ??
      Math.max(
        0,
        Math.round(
          (workout.endDate.getTime() - workout.startDate.getTime()) / 1000,
        ),
      );
    const distanceM = quantityValue(workout.totalDistance);

    const existing = await getHealthWorkoutByUuid(workout.uuid);
    if (existing?.linkedMomentId != null) {
      await upsertHealthWorkout({
        uuid: workout.uuid,
        activityType,
        activityLabel: meta.label,
        startAt: workout.startDate,
        endAt: workout.endDate,
        durationSec,
        distanceM,
        linkedMomentId: existing.linkedMomentId,
      });
      completed += 1;
      report(completed, total, `Workouts ${completed} of ${workouts.length}`);
      continue;
    }

    const activity = await findOrCreateHealthActivity(
      activityCache,
      meta.emoji,
      meta.label,
      activityType,
    );
    const valuesJson = serializeActivityValuesJson({
      duration: { type: 'duration', seconds: durationSec },
    });
    const moment = await insertMoment({
      type: 'activity',
      timestamp: workout.startDate,
      finishedAt: workout.endDate,
      activityId: activity.id,
      activityEmoji: activity.emoji,
      activityLabel: activity.label,
      contentFormat: 'activity',
      activityValuesJson: valuesJson,
      importSource: HEALTHKIT_IMPORT_SOURCE,
      caption: 'From Apple Health',
    });

    await upsertHealthWorkout({
      uuid: workout.uuid,
      activityType,
      activityLabel: meta.label,
      startAt: workout.startDate,
      endAt: workout.endDate,
      durationSec,
      distanceM,
      linkedMomentId: moment.id,
    });

    completed += 1;
    report(completed, total, `Workouts ${completed} of ${workouts.length}`);
  }
}

/** Pull HealthKit summaries into SQLCipher and auto-log workout activity moments. */
export async function syncHealthKit(options?: SyncOptions): Promise<void> {
  if (!isHealthKitSupported()) {
    return;
  }
  if (!(await getHealthKitMasterEnabled())) {
    return;
  }
  if (!(await isHealthDataAvailableSafe())) {
    return;
  }

  const onProgress = options?.onProgress;
  let lookbackDays =
    options?.lookbackDays ??
    resolveRoutineLookbackDays(await getHealthKitLastSyncAt());

  if (syncInFlight) {
    // Snapshot before awaiting: .finally() resets syncInFlightLookbackDays to 0.
    const inflightLookback = syncInFlightLookbackDays;
    // A narrower in-flight run cannot satisfy a wider request.
    if (onProgress == null && inflightLookback >= lookbackDays) {
      return syncInFlight;
    }
    await syncInFlight;
    // In-flight sync may have written lastSyncAt — re-resolve routine window.
    if (options?.lookbackDays == null) {
      lookbackDays = resolveRoutineLookbackDays(await getHealthKitLastSyncAt());
    }
    // Another sync may have started while we waited; if it already covers us, join it.
    if (
      syncInFlight != null &&
      onProgress == null &&
      syncInFlightLookbackDays >= lookbackDays
    ) {
      return syncInFlight;
    }
    // The just-completed sync already covered our required range; skip a redundant pass.
    if (onProgress == null && inflightLookback >= lookbackDays) {
      return;
    }
  }

  syncInFlightLookbackDays = lookbackDays;
  syncInFlight = (async () => {
    const to = new Date();
    const from = subDays(to, lookbackDays);
    const fromKey = toDateKey(from);
    const toKey = toDateKey(to);

    const [sleepOn, stepsOn, activityOn] = await Promise.all([
      getHealthKitSleepEnabled(),
      getHealthKitStepsEnabled(),
      getHealthKitActivityEnabled(),
    ]);

    const phases: PhaseKind[] = [];
    if (sleepOn) {
      phases.push('sleep');
    }
    if (stepsOn) {
      phases.push('steps');
    }
    if (activityOn) {
      phases.push('workouts');
    }

    onProgress?.({
      phase: 'preparing',
      message: 'Preparing Apple Health import…',
      percent: 2,
    });

    const reportFor = (phase: PhaseKind, phaseIndex: number) => {
      return (completed: number, total: number, message: string) => {
        onProgress?.({
          phase,
          message,
          percent: phasePercent(phaseIndex, phases.length, completed, total),
          completed,
          total,
        });
      };
    };

    for (let i = 0; i < phases.length; i += 1) {
      const phase = phases[i];
      try {
        if (phase === 'sleep') {
          await syncSleep(from, to, reportFor('sleep', i));
        } else if (phase === 'steps') {
          await syncSteps(fromKey, toKey, reportFor('steps', i));
        } else {
          await syncWorkouts(from, to, reportFor('workouts', i));
        }
      } catch (error) {
        if (__DEV__) {
          console.warn(`[LifeMap] healthkit ${phase} sync failed`, error);
        }
        onProgress?.({
          phase,
          message: `Skipped ${phase} (unavailable)`,
          percent: phasePercent(i, phases.length, 1, 1),
        });
      }
    }

    await setHealthKitLastSyncAt(to);

    onProgress?.({
      phase: 'done',
      message: 'Imported available Health data',
      percent: 100,
    });
    notifyHealthDataUpdated();
  })().finally(() => {
    syncInFlight = null;
    syncInFlightLookbackDays = 0;
  });

  return syncInFlight;
}

export async function bootstrapHealthKit(): Promise<void> {
  if (!isHealthKitSupported() || bootstrapped) {
    return;
  }
  bootstrapped = true;

  // Change observers stay here. FG resume no longer syncs HealthKit —
  // Sleep/Steps detail await syncHealthKitOnDemand() on open (gated by setting).
  try {
    const { subscribeToChanges } =
      require('@kingstinct/react-native-healthkit') as typeof import('@kingstinct/react-native-healthkit');
    subscribeToChanges('HKCategoryTypeIdentifierSleepAnalysis', () => {
      void (async () => {
        if (!(await getHealthKitSyncOnChangesEnabled())) {
          return;
        }
        await syncHealthKit({ lookbackDays: 3 });
      })();
    });
    subscribeToChanges('HKQuantityTypeIdentifierStepCount', () => {
      void (async () => {
        if (!(await getHealthKitSyncOnChangesEnabled())) {
          return;
        }
        await syncHealthKit({ lookbackDays: 3 });
      })();
    });
  } catch {
    // Subscription is best-effort; foreground + detail-screen sync still run.
  }

  if (!(await getHealthKitMasterEnabled())) {
    return;
  }

  await syncHealthKit();
}

/** Fresh pull when opening sleep/steps detail (Watch → phone may have just landed). */
export async function syncHealthKitOnDemand(): Promise<void> {
  if (!(await getHealthKitSyncOnDetailOpenEnabled())) {
    return;
  }
  await syncHealthKit({ lookbackDays: 3 });
}
