import {
  getVisitLabelOverride,
  listVisitLabelOverridesForDay,
  matchVisitLabelOverride,
  type VisitLabelOverrideRow,
} from '@/db/repositories/visit-label-overrides';
import type { ResolvedPlaceFields } from '@/lib/resolved-place';

export function visitLabelOverrideToResolved(
  override: VisitLabelOverrideRow,
  fallback: ResolvedPlaceFields | null = null,
): ResolvedPlaceFields {
  return {
    placeLabel: fallback?.placeLabel ?? null,
    placeId: override.placeId ?? fallback?.placeId ?? null,
    placeKind: override.placeKind ?? fallback?.placeKind ?? null,
    poiId: override.poiId,
    poiLabel: override.poiLabel ?? fallback?.poiLabel ?? null,
    poiCategory: fallback?.poiCategory ?? null,
  };
}

/** Prefer user override when no sealed trip poi is present. */
export function shouldApplyVisitLabelOverride(args: {
  materializedTripId: number | null;
  poiId: number | null;
  openThroughNow?: boolean;
}): boolean {
  if (args.openThroughNow) {
    return true;
  }
  if (args.materializedTripId == null) {
    return true;
  }
  return args.poiId == null;
}

export async function loadVisitLabelOverrideForStay(
  dateKey: string,
  startAt: Date,
): Promise<VisitLabelOverrideRow | null> {
  return getVisitLabelOverride(dateKey, startAt.getTime());
}

export async function visitLabelOverridesByStartMs(
  dateKey: string,
): Promise<Map<number, VisitLabelOverrideRow>> {
  const rows = await listVisitLabelOverridesForDay(dateKey);
  const map = new Map<number, VisitLabelOverrideRow>();
  for (const row of rows) {
    map.set(row.startAtMs, row);
  }
  return map;
}

export function findVisitLabelOverrideForStart(
  overrides: readonly VisitLabelOverrideRow[],
  startAtMs: number,
): VisitLabelOverrideRow | null {
  return matchVisitLabelOverride(overrides, startAtMs);
}

export function mergeOverrideIntoPersistLabel(
  labels: ResolvedPlaceFields,
  override: VisitLabelOverrideRow | null,
): ResolvedPlaceFields {
  if (override == null) {
    return labels;
  }
  // User pick always wins over detection / prior row for this seal.
  return {
    placeLabel: labels.placeLabel,
    placeId: override.placeId ?? labels.placeId,
    placeKind: override.placeKind ?? labels.placeKind,
    poiId: override.poiId,
    poiLabel: override.poiLabel ?? labels.poiLabel,
    poiCategory: labels.poiCategory,
  };
}
