import type { MomentRow } from '@/db/repositories/moments';
import type { TripPointRow } from '@/db/repositories/trip-points';
import {
  emptyMomentCounts,
  type MomentCounts,
} from '@/lib/moments/moment-counts';

export type TripMomentKind = MomentRow['type'];

export type TripMomentRef = {
  momentId: number;
  momentKind: TripMomentKind;
};

export type RouteMomentAnchor = {
  momentId: number;
  lat: number;
  lng: number;
};

export function momentTimestampInSegment(
  moment: Pick<MomentRow, 'timestamp'>,
  startAt: Date,
  endAt: Date,
): boolean {
  const timestampMs = moment.timestamp.getTime();
  return timestampMs >= startAt.getTime() && timestampMs <= endAt.getTime();
}

export function buildMomentRefsForSegment(
  moments: readonly MomentRow[],
  startAt: Date,
  endAt: Date,
): TripMomentRef[] {
  return moments
    .filter(moment => momentTimestampInSegment(moment, startAt, endAt))
    .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
    .map(moment => ({
      momentId: moment.id,
      momentKind: moment.type,
    }));
}

export function parseMomentRefs(
  raw: string | null | undefined,
): TripMomentRef[] {
  if (raw == null || raw.trim().length === 0) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }
    const refs: TripMomentRef[] = [];
    for (const item of parsed) {
      if (typeof item !== 'object' || item == null) {
        continue;
      }
      const record = item as Record<string, unknown>;
      const momentId =
        typeof record.momentId === 'number' ? record.momentId : null;
      const momentKind = record.momentKind;
      if (
        momentId == null ||
        (momentKind !== 'photo' &&
          momentKind !== 'note' &&
          momentKind !== 'video' &&
          momentKind !== 'voice' &&
          momentKind !== 'activity')
      ) {
        continue;
      }
      refs.push({ momentId, momentKind });
    }
    return refs;
  } catch {
    return [];
  }
}

export function serializeMomentRefs(
  refs: readonly TripMomentRef[],
): string | null {
  if (refs.length === 0) {
    return null;
  }
  return JSON.stringify(refs);
}

export function momentCountsFromRefs(
  refs: readonly TripMomentRef[],
): MomentCounts {
  const counts = emptyMomentCounts();
  for (const ref of refs) {
    if (ref.momentKind === 'photo') {
      counts.photo += 1;
    } else if (ref.momentKind === 'video') {
      counts.video += 1;
    } else if (ref.momentKind === 'voice') {
      counts.voice += 1;
    } else if (ref.momentKind === 'note') {
      counts.note += 1;
    } else if (ref.momentKind === 'activity') {
      counts.activity += 1;
    }
  }
  return counts;
}

export function momentsForTripRefs(
  dayMoments: readonly MomentRow[],
  refs: readonly TripMomentRef[],
): MomentRow[] {
  if (refs.length === 0) {
    return [];
  }
  const byId = new Map(dayMoments.map(moment => [moment.id, moment]));
  return refs
    .map(ref => byId.get(ref.momentId))
    .filter((moment): moment is MomentRow => moment != null);
}

export function routeMomentAnchorsFromTripPoints(
  route: readonly TripPointRow[],
): RouteMomentAnchor[] {
  return route
    .filter(point => point.momentId != null)
    .map(point => ({
      momentId: point.momentId!,
      lat: point.lat,
      lng: point.lng,
    }));
}

export function momentKindForRef(
  refs: readonly TripMomentRef[],
  momentId: number,
): TripMomentKind | null {
  return refs.find(ref => ref.momentId === momentId)?.momentKind ?? null;
}

export function isMaterializedEntry(entry: {
  kind: string;
  materializedTripId?: number;
}): boolean {
  return entry.kind !== 'gap' && entry.materializedTripId != null;
}
