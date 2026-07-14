import { and, eq } from 'drizzle-orm';

import type { PlaceKind } from '@/lib/trip-detection';

import { getDatabase } from '../client';
import { visitLabelOverrides } from '../schema';

/** Match overrides when live detect slightly shifts stay start. */
export const VISIT_LABEL_OVERRIDE_START_MATCH_MS = 5 * 60 * 1000;

export type VisitLabelOverrideRow = {
  id: number;
  dateKey: string;
  startAtMs: number;
  poiId: number;
  poiLabel: string | null;
  placeId: number | null;
  placeKind: PlaceKind | null;
  updatedAt: Date;
};

function mapRow(
  row: typeof visitLabelOverrides.$inferSelect,
): VisitLabelOverrideRow {
  return {
    id: row.id,
    dateKey: row.dateKey,
    startAtMs: row.startAtMs,
    poiId: row.poiId,
    poiLabel: row.poiLabel?.trim() || null,
    placeId: row.placeId,
    placeKind: (row.placeKind as PlaceKind | null) ?? null,
    updatedAt: row.updatedAt,
  };
}

export type UpsertVisitLabelOverrideInput = {
  dateKey: string;
  startAtMs: number;
  poiId: number;
  poiLabel?: string | null;
  placeId?: number | null;
  placeKind?: PlaceKind | null;
};

export async function upsertVisitLabelOverride(
  input: UpsertVisitLabelOverrideInput,
): Promise<VisitLabelOverrideRow> {
  const db = await getDatabase();
  const updatedAt = new Date();
  const values = {
    dateKey: input.dateKey,
    startAtMs: input.startAtMs,
    poiId: input.poiId,
    poiLabel: input.poiLabel?.trim() || null,
    placeId: input.placeId ?? null,
    placeKind: input.placeKind ?? null,
    updatedAt,
  };

  await db
    .insert(visitLabelOverrides)
    .values(values)
    .onConflictDoUpdate({
      target: [visitLabelOverrides.dateKey, visitLabelOverrides.startAtMs],
      set: {
        poiId: values.poiId,
        poiLabel: values.poiLabel,
        placeId: values.placeId,
        placeKind: values.placeKind,
        updatedAt,
      },
    });

  const row = await getVisitLabelOverrideExact(input.dateKey, input.startAtMs);
  if (!row) {
    throw new Error('visit_label_override upsert failed to read back');
  }
  return row;
}

export async function getVisitLabelOverrideExact(
  dateKey: string,
  startAtMs: number,
): Promise<VisitLabelOverrideRow | null> {
  const db = await getDatabase();
  const rows = await db
    .select()
    .from(visitLabelOverrides)
    .where(
      and(
        eq(visitLabelOverrides.dateKey, dateKey),
        eq(visitLabelOverrides.startAtMs, startAtMs),
      ),
    )
    .limit(1);
  const row = rows[0];
  return row ? mapRow(row) : null;
}

export async function listVisitLabelOverridesForDay(
  dateKey: string,
): Promise<VisitLabelOverrideRow[]> {
  const db = await getDatabase();
  const rows = await db
    .select()
    .from(visitLabelOverrides)
    .where(eq(visitLabelOverrides.dateKey, dateKey));
  return rows.map(mapRow);
}

/**
 * Exact start match first; otherwise nearest same-day start within
 * {@link VISIT_LABEL_OVERRIDE_START_MATCH_MS}.
 */
export function matchVisitLabelOverride(
  overrides: readonly VisitLabelOverrideRow[],
  startAtMs: number,
  windowMs: number = VISIT_LABEL_OVERRIDE_START_MATCH_MS,
): VisitLabelOverrideRow | null {
  let exact: VisitLabelOverrideRow | null = null;
  let nearest: VisitLabelOverrideRow | null = null;
  let nearestDelta = Number.POSITIVE_INFINITY;

  for (const override of overrides) {
    const delta = Math.abs(override.startAtMs - startAtMs);
    if (delta === 0) {
      exact = override;
      break;
    }
    if (delta <= windowMs && delta < nearestDelta) {
      nearest = override;
      nearestDelta = delta;
    }
  }

  return exact ?? nearest;
}

export async function getVisitLabelOverride(
  dateKey: string,
  startAtMs: number,
): Promise<VisitLabelOverrideRow | null> {
  const exact = await getVisitLabelOverrideExact(dateKey, startAtMs);
  if (exact) {
    return exact;
  }
  const dayOverrides = await listVisitLabelOverridesForDay(dateKey);
  return matchVisitLabelOverride(dayOverrides, startAtMs);
}

export async function deleteVisitLabelOverride(
  dateKey: string,
  startAtMs: number,
): Promise<void> {
  const db = await getDatabase();
  await db
    .delete(visitLabelOverrides)
    .where(
      and(
        eq(visitLabelOverrides.dateKey, dateKey),
        eq(visitLabelOverrides.startAtMs, startAtMs),
      ),
    );
}

export async function deleteVisitLabelOverrideById(id: number): Promise<void> {
  const db = await getDatabase();
  await db
    .delete(visitLabelOverrides)
    .where(eq(visitLabelOverrides.id, id));
}
