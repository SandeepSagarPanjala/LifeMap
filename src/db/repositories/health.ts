import { and, asc, eq, gte, lt, sql } from 'drizzle-orm';

import { getDatabase } from '@/db/client';
import {
  healthDaySteps,
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

export async function countHealthSleepSessions(): Promise<number> {
  const db = await getDatabase();
  const [row] = await db
    .select({ n: sql<number>`count(*)` })
    .from(healthSleepSessions);
  return Number(row?.n ?? 0);
}
