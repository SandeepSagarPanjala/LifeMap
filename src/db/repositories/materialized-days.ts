import { eq, sql } from 'drizzle-orm';

import { getDatabase } from '../client';
import { materializedDays } from '../schema';

export type MaterializedDayStatus = 'open' | 'partial' | 'complete' | 'failed';

export type MaterializedDayRow = {
  dateKey: string;
  status: MaterializedDayStatus;
  detectionVersion: number;
  tripCount: number;
  pointCount: number;
  geometryFingerprint: string | null;
  excludedCrossMidnightFromMs: number | null;
  sealedAt: Date | null;
  updatedAt: Date;
};

function mapRow(row: typeof materializedDays.$inferSelect): MaterializedDayRow {
  return {
    dateKey: row.dateKey,
    status: row.status as MaterializedDayStatus,
    detectionVersion: row.detectionVersion,
    tripCount: row.tripCount,
    pointCount: row.pointCount,
    geometryFingerprint: row.geometryFingerprint ?? null,
    excludedCrossMidnightFromMs: row.excludedCrossMidnightFromMs ?? null,
    sealedAt: row.sealedAt,
    updatedAt: row.updatedAt,
  };
}

export async function getMaterializedDay(
  dateKey: string,
): Promise<MaterializedDayRow | null> {
  const db = await getDatabase();
  const rows = await db
    .select()
    .from(materializedDays)
    .where(eq(materializedDays.dateKey, dateKey))
    .limit(1);
  return rows[0] ? mapRow(rows[0]) : null;
}

export async function upsertMaterializedDay(
  dateKey: string,
  patch: {
    status: MaterializedDayStatus;
    detectionVersion: number;
    tripCount: number;
    pointCount: number;
    geometryFingerprint?: string | null;
    excludedCrossMidnightFromMs?: number | null;
    sealedAt?: Date | null;
  },
): Promise<void> {
  const db = await getDatabase();
  const now = new Date();
  await db
    .insert(materializedDays)
    .values({
      dateKey,
      status: patch.status,
      detectionVersion: patch.detectionVersion,
      tripCount: patch.tripCount,
      pointCount: patch.pointCount,
      geometryFingerprint: patch.geometryFingerprint ?? null,
      excludedCrossMidnightFromMs: patch.excludedCrossMidnightFromMs ?? null,
      sealedAt: patch.sealedAt ?? null,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: materializedDays.dateKey,
      set: {
        status: patch.status,
        detectionVersion: patch.detectionVersion,
        tripCount: patch.tripCount,
        pointCount: patch.pointCount,
        geometryFingerprint: patch.geometryFingerprint ?? null,
        excludedCrossMidnightFromMs: patch.excludedCrossMidnightFromMs ?? null,
        sealedAt: patch.sealedAt ?? null,
        updatedAt: now,
      },
    });
}

export async function clearExcludedCrossMidnightDrive(
  dateKey: string,
): Promise<void> {
  const existing = await getMaterializedDay(dateKey);
  if (existing == null || existing.excludedCrossMidnightFromMs == null) {
    return;
  }
  await upsertMaterializedDay(dateKey, {
    status: existing.status,
    detectionVersion: existing.detectionVersion,
    tripCount: existing.tripCount,
    pointCount: existing.pointCount,
    geometryFingerprint: existing.geometryFingerprint,
    excludedCrossMidnightFromMs: null,
    sealedAt: existing.sealedAt,
  });
}

export async function countMaterializedDays(): Promise<number> {
  const db = await getDatabase();
  const [row] = await db
    .select({ count: sql<number>`cast(count(*) as integer)` })
    .from(materializedDays);
  return row?.count ?? 0;
}

export async function deleteAllMaterializedDays(): Promise<number> {
  const db = await getDatabase();
  const deleted = await db
    .delete(materializedDays)
    .returning({ dateKey: materializedDays.dateKey });
  return deleted.length;
}

export async function markMaterializedDayFailed(
  dateKey: string,
  detectionVersion: number,
): Promise<void> {
  const existing = await getMaterializedDay(dateKey);
  await upsertMaterializedDay(dateKey, {
    status: 'failed',
    detectionVersion,
    tripCount: existing?.tripCount ?? 0,
    pointCount: existing?.pointCount ?? 0,
    geometryFingerprint: existing?.geometryFingerprint ?? null,
    excludedCrossMidnightFromMs: existing?.excludedCrossMidnightFromMs ?? null,
    sealedAt: existing?.sealedAt ?? null,
  });
}
