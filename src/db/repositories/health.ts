import { and, asc, desc, eq, gte, lte, lt, sql } from 'drizzle-orm';

import { getDatabase } from '@/db/client';
import {
  healthDaySleep,
  healthDaySteps,
  healthSleepSamples,
  healthSleepSessions,
  healthWorkouts,
} from '@/db/schema';

export type HealthSleepSessionRow = {
  id: number;
  uuid: string;
  startAt: Date;
  endAt: Date;
  sourceName: string | null;
  syncedAt: Date;
};

export type HealthWorkoutRow = {
  id: number;
  uuid: string;
  activityType: number;
  activityLabel: string;
  startAt: Date;
  endAt: Date;
  durationSec: number;
  distanceM: number | null;
  linkedMomentId: number | null;
  syncedAt: Date;
};

export async function upsertSleepSession(input: {
  uuid: string;
  startAt: Date;
  endAt: Date;
  sourceName?: string | null;
}): Promise<void> {
  const db = await getDatabase();
  const syncedAt = new Date();
  await db
    .insert(healthSleepSessions)
    .values({
      uuid: input.uuid,
      startAt: input.startAt,
      endAt: input.endAt,
      sourceName: input.sourceName ?? null,
      syncedAt,
    })
    .onConflictDoUpdate({
      target: healthSleepSessions.uuid,
      set: {
        startAt: input.startAt,
        endAt: input.endAt,
        sourceName: input.sourceName ?? null,
        syncedAt,
      },
    });
}

export async function listSleepSessionsOverlapping(
  start: Date,
  end: Date,
): Promise<HealthSleepSessionRow[]> {
  const db = await getDatabase();
  const rows = await db
    .select()
    .from(healthSleepSessions)
    .where(
      and(
        lt(healthSleepSessions.startAt, end),
        gte(healthSleepSessions.endAt, start),
      ),
    )
    .orderBy(asc(healthSleepSessions.startAt));
  return rows.map(row => ({
    id: row.id,
    uuid: row.uuid,
    startAt: row.startAt,
    endAt: row.endAt,
    sourceName: row.sourceName ?? null,
    syncedAt: row.syncedAt,
  }));
}

/**
 * Delete locally mirrored sleep sessions that overlap a time range.
 * Apple Health remains unchanged, so the next HealthKit sync can import them again.
 */
export async function deleteSleepSessionsOverlapping(
  start: Date,
  end: Date,
): Promise<number> {
  const db = await getDatabase();
  const rows = await db
    .delete(healthSleepSessions)
    .where(
      and(
        lt(healthSleepSessions.startAt, end),
        gte(healthSleepSessions.endAt, start),
      ),
    )
    .returning({ id: healthSleepSessions.id });
  return rows.length;
}

/** Clear samples + day rollups overlapping a range (dev / dogfood). */
export async function deleteLocalSleepDataOverlapping(
  start: Date,
  end: Date,
  dateKeys: string[],
): Promise<{ sessions: number; samples: number; days: number }> {
  const db = await getDatabase();
  const sessions = await db
    .delete(healthSleepSessions)
    .where(
      and(
        lt(healthSleepSessions.startAt, end),
        gte(healthSleepSessions.endAt, start),
      ),
    )
    .returning({ id: healthSleepSessions.id });
  const samples = await db
    .delete(healthSleepSamples)
    .where(
      and(
        lt(healthSleepSamples.startAt, end),
        gte(healthSleepSamples.endAt, start),
      ),
    )
    .returning({ id: healthSleepSamples.id });
  let days = 0;
  for (const dateKey of dateKeys) {
    const removed = await db
      .delete(healthDaySleep)
      .where(eq(healthDaySleep.dateKey, dateKey))
      .returning({ dateKey: healthDaySleep.dateKey });
    days += removed.length;
  }
  return {
    sessions: sessions.length,
    samples: samples.length,
    days,
  };
}

export async function upsertHealthWorkout(input: {
  uuid: string;
  activityType: number;
  activityLabel: string;
  startAt: Date;
  endAt: Date;
  durationSec: number;
  distanceM?: number | null;
  linkedMomentId?: number | null;
}): Promise<HealthWorkoutRow> {
  const db = await getDatabase();
  const syncedAt = new Date();
  const existing = await db
    .select()
    .from(healthWorkouts)
    .where(eq(healthWorkouts.uuid, input.uuid))
    .limit(1);

  if (existing[0]) {
    const rows = await db
      .update(healthWorkouts)
      .set({
        activityType: input.activityType,
        activityLabel: input.activityLabel,
        startAt: input.startAt,
        endAt: input.endAt,
        durationSec: input.durationSec,
        distanceM: input.distanceM ?? null,
        linkedMomentId:
          input.linkedMomentId !== undefined
            ? input.linkedMomentId
            : existing[0].linkedMomentId,
        syncedAt,
      })
      .where(eq(healthWorkouts.uuid, input.uuid))
      .returning();
    const row = rows[0]!;
    return {
      id: row.id,
      uuid: row.uuid,
      activityType: row.activityType,
      activityLabel: row.activityLabel,
      startAt: row.startAt,
      endAt: row.endAt,
      durationSec: row.durationSec,
      distanceM: row.distanceM ?? null,
      linkedMomentId: row.linkedMomentId ?? null,
      syncedAt: row.syncedAt,
    };
  }

  const rows = await db
    .insert(healthWorkouts)
    .values({
      uuid: input.uuid,
      activityType: input.activityType,
      activityLabel: input.activityLabel,
      startAt: input.startAt,
      endAt: input.endAt,
      durationSec: input.durationSec,
      distanceM: input.distanceM ?? null,
      linkedMomentId: input.linkedMomentId ?? null,
      syncedAt,
    })
    .returning();
  const row = rows[0]!;
  return {
    id: row.id,
    uuid: row.uuid,
    activityType: row.activityType,
    activityLabel: row.activityLabel,
    startAt: row.startAt,
    endAt: row.endAt,
    durationSec: row.durationSec,
    distanceM: row.distanceM ?? null,
    linkedMomentId: row.linkedMomentId ?? null,
    syncedAt: row.syncedAt,
  };
}

export async function getHealthWorkoutByUuid(
  uuid: string,
): Promise<HealthWorkoutRow | null> {
  const db = await getDatabase();
  const rows = await db
    .select()
    .from(healthWorkouts)
    .where(eq(healthWorkouts.uuid, uuid))
    .limit(1);
  const row = rows[0];
  if (!row) {
    return null;
  }
  return {
    id: row.id,
    uuid: row.uuid,
    activityType: row.activityType,
    activityLabel: row.activityLabel,
    startAt: row.startAt,
    endAt: row.endAt,
    durationSec: row.durationSec,
    distanceM: row.distanceM ?? null,
    linkedMomentId: row.linkedMomentId ?? null,
    syncedAt: row.syncedAt,
  };
}

export async function listHealthWorkoutsOverlapping(
  start: Date,
  end: Date,
): Promise<HealthWorkoutRow[]> {
  const db = await getDatabase();
  const rows = await db
    .select()
    .from(healthWorkouts)
    .where(
      and(lt(healthWorkouts.startAt, end), gte(healthWorkouts.endAt, start)),
    )
    .orderBy(asc(healthWorkouts.startAt));
  return rows.map(row => ({
    id: row.id,
    uuid: row.uuid,
    activityType: row.activityType,
    activityLabel: row.activityLabel,
    startAt: row.startAt,
    endAt: row.endAt,
    durationSec: row.durationSec,
    distanceM: row.distanceM ?? null,
    linkedMomentId: row.linkedMomentId ?? null,
    syncedAt: row.syncedAt,
  }));
}

export async function upsertDaySteps(
  dateKey: string,
  steps: number,
): Promise<void> {
  const db = await getDatabase();
  const syncedAt = new Date();
  await db
    .insert(healthDaySteps)
    .values({ dateKey, steps, syncedAt })
    .onConflictDoUpdate({
      target: healthDaySteps.dateKey,
      set: { steps, syncedAt },
    });
}

export async function getDaySteps(dateKey: string): Promise<number | null> {
  const db = await getDatabase();
  const rows = await db
    .select()
    .from(healthDaySteps)
    .where(eq(healthDaySteps.dateKey, dateKey))
    .limit(1);
  return rows[0]?.steps ?? null;
}

export type HealthDayStepsRow = {
  dateKey: string;
  steps: number;
  syncedAt: Date;
};

/** Day-step rows newest first; `beforeDateKey` is exclusive. */
export async function listDayStepsBefore(
  beforeDateKey: string | null,
  limit: number,
): Promise<HealthDayStepsRow[]> {
  const db = await getDatabase();
  const rows = await db
    .select()
    .from(healthDaySteps)
    .where(
      beforeDateKey != null
        ? lt(healthDaySteps.dateKey, beforeDateKey)
        : undefined,
    )
    .orderBy(desc(healthDaySteps.dateKey))
    .limit(limit);
  return rows.map(row => ({
    dateKey: row.dateKey,
    steps: row.steps,
    syncedAt: row.syncedAt,
  }));
}

export type HealthSleepSampleRow = {
  id: number;
  uuid: string;
  startAt: Date;
  endAt: Date;
  value: number;
  syncedAt: Date;
};

export async function upsertSleepSample(input: {
  uuid: string;
  startAt: Date;
  endAt: Date;
  value: number;
}): Promise<void> {
  const db = await getDatabase();
  const syncedAt = new Date();
  await db
    .insert(healthSleepSamples)
    .values({
      uuid: input.uuid,
      startAt: input.startAt,
      endAt: input.endAt,
      value: input.value,
      syncedAt,
    })
    .onConflictDoUpdate({
      target: healthSleepSamples.uuid,
      set: {
        startAt: input.startAt,
        endAt: input.endAt,
        value: input.value,
        syncedAt,
      },
    });
}

export type HealthDaySleepRow = {
  dateKey: string;
  asleepMs: number;
  awakeMs: number;
  remMs: number;
  coreMs: number;
  deepMs: number;
  unspecifiedMs: number;
  awakeningsOver5Min: number;
  sleepStartAt: Date | null;
  sleepEndAt: Date | null;
  score: number | null;
  syncedAt: Date;
};

export async function upsertDaySleep(input: {
  dateKey: string;
  asleepMs: number;
  awakeMs: number;
  remMs: number;
  coreMs: number;
  deepMs: number;
  unspecifiedMs: number;
  awakeningsOver5Min: number;
  sleepStartAt: Date | null;
  sleepEndAt: Date | null;
  score: number | null;
}): Promise<void> {
  const db = await getDatabase();
  const syncedAt = new Date();
  await db
    .insert(healthDaySleep)
    .values({
      dateKey: input.dateKey,
      asleepMs: input.asleepMs,
      awakeMs: input.awakeMs,
      remMs: input.remMs,
      coreMs: input.coreMs,
      deepMs: input.deepMs,
      unspecifiedMs: input.unspecifiedMs,
      awakeningsOver5Min: input.awakeningsOver5Min,
      sleepStartAt: input.sleepStartAt,
      sleepEndAt: input.sleepEndAt,
      score: input.score,
      syncedAt,
    })
    .onConflictDoUpdate({
      target: healthDaySleep.dateKey,
      set: {
        asleepMs: input.asleepMs,
        awakeMs: input.awakeMs,
        remMs: input.remMs,
        coreMs: input.coreMs,
        deepMs: input.deepMs,
        unspecifiedMs: input.unspecifiedMs,
        awakeningsOver5Min: input.awakeningsOver5Min,
        sleepStartAt: input.sleepStartAt,
        sleepEndAt: input.sleepEndAt,
        score: input.score,
        syncedAt,
      },
    });
}

export async function getDaySleep(
  dateKey: string,
): Promise<HealthDaySleepRow | null> {
  const db = await getDatabase();
  const rows = await db
    .select()
    .from(healthDaySleep)
    .where(eq(healthDaySleep.dateKey, dateKey))
    .limit(1);
  const row = rows[0];
  if (!row) {
    return null;
  }
  return mapDaySleepRow(row);
}

/**
 * Page of day-sleep rows for the chart, newest first.
 * `beforeDateKey` exclusive — pass the oldest loaded key to fetch older pages.
 */
export async function listDaySleepBefore(
  beforeDateKey: string | null,
  limit: number,
): Promise<HealthDaySleepRow[]> {
  const db = await getDatabase();
  const rows = await db
    .select()
    .from(healthDaySleep)
    .where(
      beforeDateKey != null
        ? lt(healthDaySleep.dateKey, beforeDateKey)
        : undefined,
    )
    .orderBy(desc(healthDaySleep.dateKey))
    .limit(limit);
  return rows.map(mapDaySleepRow);
}

/** Inclusive range for filling chart gaps (oldest → newest). */
export async function listDaySleepInRange(
  fromDateKey: string,
  toDateKey: string,
): Promise<HealthDaySleepRow[]> {
  const db = await getDatabase();
  const rows = await db
    .select()
    .from(healthDaySleep)
    .where(
      and(
        gte(healthDaySleep.dateKey, fromDateKey),
        lte(healthDaySleep.dateKey, toDateKey),
      ),
    )
    .orderBy(asc(healthDaySleep.dateKey));
  return rows.map(mapDaySleepRow);
}

function mapDaySleepRow(row: typeof healthDaySleep.$inferSelect): HealthDaySleepRow {
  return {
    dateKey: row.dateKey,
    asleepMs: row.asleepMs,
    awakeMs: row.awakeMs,
    remMs: row.remMs,
    coreMs: row.coreMs,
    deepMs: row.deepMs,
    unspecifiedMs: row.unspecifiedMs,
    awakeningsOver5Min: row.awakeningsOver5Min ?? 0,
    sleepStartAt: row.sleepStartAt ?? null,
    sleepEndAt: row.sleepEndAt ?? null,
    score: row.score ?? null,
    syncedAt: row.syncedAt,
  };
}

export async function countHealthSleepSessions(): Promise<number> {
  const db = await getDatabase();
  const [row] = await db
    .select({ n: sql<number>`count(*)` })
    .from(healthSleepSessions);
  return Number(row?.n ?? 0);
}
