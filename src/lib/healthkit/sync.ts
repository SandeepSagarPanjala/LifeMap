import { AppState } from 'react-native';
import { subDays } from 'date-fns';

import {
  createActivity,
  listActiveActivities,
  type ActivityRow,
} from '@/db/repositories/activities';
import {
  getHealthWorkoutByUuid,
  upsertDaySteps,
  upsertHealthWorkout,
  upsertSleepSession,
} from '@/db/repositories/health';
import { insertMoment } from '@/db/repositories/moments';
import {
  serializeActivityValuesJson,
  type ActivityFieldDefinition,
} from '@/lib/activities/activity-definition';
import { getDayRange, shiftDateKey, toDateKey } from '@/lib/day-utils';

import { notifyHealthDataUpdated } from './events';
import { coalesceSleepSessions } from './sleep-math';
import {
  getHealthKitActivityEnabled,
  getHealthKitMasterEnabled,
  getHealthKitSleepEnabled,
  getHealthKitStepsEnabled,
} from './settings';
import { isHealthDataAvailableSafe, isHealthKitSupported } from './permissions';
import { HEALTHKIT_IMPORT_SOURCE } from './types';
import { workoutMetaForType } from './workout-labels';

const LOOKBACK_DAYS = 30;

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

export type HealthSyncProgressCallback = (
  progress: HealthSyncProgress,
) => void;

type SyncOptions = {
  onProgress?: HealthSyncProgressCallback;
};

let syncInFlight: Promise<void> | null = null;
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
  emoji: string,
  label: string,
  activityType: number,
): Promise<ActivityRow> {
  const templateId = `healthkit:workout:${activityType}`;
  const existing = await listActiveActivities();
  const match = existing.find(
    a =>
      a.templateId === templateId ||
      (a.source === 'healthkit' && a.label === label),
  );
  if (match) {
    return match;
  }
  return createActivity({
    emoji,
    label,
    fields: [DURATION_FIELD],
    source: 'healthkit',
    templateId,
  });
}

async function syncSleep(
  from: Date,
  to: Date,
  report: (completed: number, total: number, message: string) => void,
): Promise<void> {
  const {
    queryCategorySamples,
  } = require('@kingstinct/react-native-healthkit') as typeof import('@kingstinct/react-native-healthkit');

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

  const coalesced = coalesceSleepSessions(
    samples.map(s => ({
      uuid: s.uuid,
      startAt: s.startDate,
      endAt: s.endDate,
      value: Number(s.value),
    })),
  );

  const total = Math.max(1, coalesced.length);
  if (coalesced.length === 0) {
    report(1, 1, 'No sleep sessions in range');
    return;
  }

  let completed = 0;
  for (const session of coalesced) {
    await upsertSleepSession({
      uuid: session.uuid,
      startAt: session.startAt,
      endAt: session.endAt,
    });
    completed += 1;
    report(
      completed,
      total,
      `Saving sleep ${completed} of ${coalesced.length}`,
    );
  }
}

async function syncSteps(
  fromDateKey: string,
  toDateKey: string,
  report: (completed: number, total: number, message: string) => void,
): Promise<void> {
  const {
    queryStatisticsForQuantity,
  } = require('@kingstinct/react-native-healthkit') as typeof import('@kingstinct/react-native-healthkit');

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
  const {
    queryWorkoutSamples,
  } = require('@kingstinct/react-native-healthkit') as typeof import('@kingstinct/react-native-healthkit');

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
      report(
        completed,
        total,
        `Workouts ${completed} of ${workouts.length}`,
      );
      continue;
    }

    const activity = await findOrCreateHealthActivity(
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
    report(
      completed,
      total,
      `Workouts ${completed} of ${workouts.length}`,
    );
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

  if (syncInFlight) {
    if (onProgress == null) {
      return syncInFlight;
    }
    await syncInFlight;
  }

  syncInFlight = (async () => {
    const to = new Date();
    const from = subDays(to, LOOKBACK_DAYS);
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

    onProgress?.({
      phase: 'done',
      message: 'Imported available Health data',
      percent: 100,
    });
    notifyHealthDataUpdated();
  })().finally(() => {
    syncInFlight = null;
  });

  return syncInFlight;
}

export async function bootstrapHealthKit(): Promise<void> {
  if (!isHealthKitSupported() || bootstrapped) {
    return;
  }
  bootstrapped = true;

  // Always listen; syncHealthKit no-ops when master is off.
  AppState.addEventListener('change', state => {
    if (state === 'active') {
      void syncHealthKit();
    }
  });

  if (!(await getHealthKitMasterEnabled())) {
    return;
  }

  await syncHealthKit();
}
