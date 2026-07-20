import { and, eq } from 'drizzle-orm';

import type { PlaceKind } from '@/lib/trip-detection';
import { isWithinPlaceLookupVenue } from '@/lib/place-lookup-venue';

import { getDatabase } from '../client';
import { visitLabelOverrides } from '../schema';

/**
 * @deprecated Fuzzy start matching was removed — overrides match exact start
 * only so back-to-back visits cannot inherit each other's placeId.
 * Kept as `0` for older call sites / backup import signatures.
 */
export const VISIT_LABEL_OVERRIDE_START_MATCH_MS = 0;

export type VisitLabelOverrideRow = {
  id: number;
  dateKey: string;
  startAtMs: number;
  endAtMs: number | null;
  anchorLat: number | null;
  anchorLng: number | null;
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
    endAtMs: row.endAtMs ?? null,
    anchorLat: row.anchorLat ?? null,
    anchorLng: row.anchorLng ?? null,
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
  endAtMs?: number | null;
  anchorLat?: number | null;
  anchorLng?: number | null;
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
    endAtMs: input.endAtMs ?? null,
    anchorLat: input.anchorLat ?? null,
    anchorLng: input.anchorLng ?? null,
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
        endAtMs: values.endAtMs,
        anchorLat: values.anchorLat,
        anchorLng: values.anchorLng,
        poiId: values.poiId,
        poiLabel: values.poiLabel,
        placeId: values.placeId,
        placeKind: values.placeKind,
        updatedAt,
      },
    });

  const row = await getVisitLabelOverrideExact(input.dateKey, input.startAtMs);
  if (!row) {
    throw new Error(
      `visit_label_override upsert failed to read back (${input.dateKey} @ ${input.startAtMs})`,
    );
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
 * Exact start match only. Do not fuzzy-match nearby starts — two different
 * venues minutes apart must not share a label / placeId.
 */
export function matchVisitLabelOverride(
  overrides: readonly VisitLabelOverrideRow[],
  startAtMs: number,
  _windowMs: number = VISIT_LABEL_OVERRIDE_START_MATCH_MS,
): VisitLabelOverrideRow | null {
  for (const override of overrides) {
    if (override.startAtMs === startAtMs) {
      return override;
    }
  }
  return null;
}

export type VisitLabelOverrideStayAnchor = {
  startAtMs: number;
  anchorLat?: number | null;
  anchorLng?: number | null;
};

/**
 * Re-attach a user pick to a stay after a rebuild shifts its start.
 *
 * Priority:
 *   1. Exact start match (same visit boundary).
 *   2. Same-day override whose stamped anchor is within the venue radius of
 *      this stay's anchor — nearest start wins to disambiguate revisits.
 *
 * Anchor-in-radius is a spatial guard: two different venues minutes apart can
 * never swap labels (that was the old ±45-minute time-only bug). Overrides
 * without a stamped anchor (legacy rows) only match on exact start.
 */
export function matchVisitLabelOverrideForStay(
  overrides: readonly VisitLabelOverrideRow[],
  stay: VisitLabelOverrideStayAnchor,
): VisitLabelOverrideRow | null {
  const exact = matchVisitLabelOverride(overrides, stay.startAtMs);
  if (exact != null) {
    return exact;
  }

  if (stay.anchorLat == null || stay.anchorLng == null) {
    return null;
  }
  const stayAnchor = { lat: stay.anchorLat, lng: stay.anchorLng };

  let nearest: VisitLabelOverrideRow | null = null;
  let nearestDelta = Number.POSITIVE_INFINITY;
  for (const override of overrides) {
    if (override.anchorLat == null || override.anchorLng == null) {
      continue;
    }
    const withinVenue = isWithinPlaceLookupVenue(stayAnchor, {
      lat: override.anchorLat,
      lng: override.anchorLng,
    });
    if (!withinVenue) {
      continue;
    }
    const delta = Math.abs(override.startAtMs - stay.startAtMs);
    if (delta < nearestDelta) {
      nearest = override;
      nearestDelta = delta;
    }
  }
  return nearest;
}

export async function getVisitLabelOverride(
  dateKey: string,
  startAtMs: number,
  anchor?: { lat: number | null; lng: number | null } | null,
): Promise<VisitLabelOverrideRow | null> {
  const exact = await getVisitLabelOverrideExact(dateKey, startAtMs);
  if (exact) {
    return exact;
  }
  const dayOverrides = await listVisitLabelOverridesForDay(dateKey);
  return matchVisitLabelOverrideForStay(dayOverrides, {
    startAtMs,
    anchorLat: anchor?.lat ?? null,
    anchorLng: anchor?.lng ?? null,
  });
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
