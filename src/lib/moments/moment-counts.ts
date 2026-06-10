import type {MomentRow} from '@/db/repositories/moments';
import type {LocationPointRow} from '@/db/repositories/location-days';
import type {DayTimelineEntry} from '@/lib/trip-detection';

import {
  effectiveTimelineEntryEnd,
  findContainingTimelineEntry,
  resolveMomentCoordinate,
} from './moment-timeline';

export type MomentCounts = {
  photo: number;
  voice: number;
  note: number;
};

export type TravelMomentMarker = {
  key: string;
  coordinate: {latitude: number; longitude: number};
  counts: MomentCounts;
  momentIds: number[];
};

export function emptyMomentCounts(): MomentCounts {
  return {photo: 0, voice: 0, note: 0};
}

export function hasMomentCounts(counts: MomentCounts): boolean {
  return counts.photo > 0 || counts.voice > 0 || counts.note > 0;
}

export function countMoments(moments: MomentRow[]): MomentCounts {
  const counts = emptyMomentCounts();
  for (const moment of moments) {
    if (moment.type === 'photo') {
      counts.photo += 1;
    } else if (moment.type === 'voice') {
      counts.voice += 1;
    } else if (moment.type === 'note') {
      counts.note += 1;
    }
  }
  return counts;
}

export function momentBelongsToEntry(
  moment: MomentRow,
  entry: DayTimelineEntry,
  now: Date,
): boolean {
  const timestampMs = moment.timestamp.getTime();
  return (
    timestampMs >= entry.startAt.getTime() &&
    timestampMs <= effectiveTimelineEntryEnd(entry, now).getTime()
  );
}

export function countMomentsForEntry(
  moments: MomentRow[],
  entry: DayTimelineEntry,
  now: Date = new Date(),
): MomentCounts {
  const counts = emptyMomentCounts();
  for (const moment of moments) {
    if (!momentBelongsToEntry(moment, entry, now)) {
      continue;
    }
    if (moment.type === 'photo') {
      counts.photo += 1;
    } else if (moment.type === 'voice') {
      counts.voice += 1;
    } else if (moment.type === 'note') {
      counts.note += 1;
    }
  }
  return counts;
}

export function filterMomentsForEntry(
  moments: MomentRow[],
  entry: DayTimelineEntry,
  now: Date = new Date(),
): MomentRow[] {
  return moments.filter(moment => momentBelongsToEntry(moment, entry, now));
}

function addToCounts(counts: MomentCounts, moment: MomentRow): void {
  if (moment.type === 'photo') {
    counts.photo += 1;
  } else if (moment.type === 'voice') {
    counts.voice += 1;
  } else if (moment.type === 'note') {
    counts.note += 1;
  }
}

function coordinateBucket(lat: number, lng: number): string {
  return `${lat.toFixed(4)}:${lng.toFixed(4)}`;
}

export function buildTravelMomentMarkers(
  moments: MomentRow[],
  entries: DayTimelineEntry[],
  points: LocationPointRow[],
  now: Date = new Date(),
): TravelMomentMarker[] {
  const grouped = new Map<string, TravelMomentMarker>();

  for (const moment of moments) {
    const entry = findContainingTimelineEntry(moment.timestamp, entries, now);
    if (entry?.kind !== 'travel') {
      continue;
    }

    const resolved = resolveMomentCoordinate(moment.timestamp, points, entry);
    if (!resolved) {
      continue;
    }

    const bucket = coordinateBucket(resolved.lat, resolved.lng);
    const existing = grouped.get(bucket);
    if (existing) {
      addToCounts(existing.counts, moment);
      existing.momentIds.push(moment.id);
      continue;
    }

    const counts = emptyMomentCounts();
    addToCounts(counts, moment);
    grouped.set(bucket, {
      key: `${bucket}-${moment.id}`,
      coordinate: {latitude: resolved.lat, longitude: resolved.lng},
      counts,
      momentIds: [moment.id],
    });
  }

  return [...grouped.values()];
}
