import {format} from 'date-fns';

import type {LocationPointRow} from '@/db/repositories/location-days';

export type LocationSaveGap = {
  startAt: Date;
  endAt: Date;
  durationMs: number;
  afterPointId: number;
  beforePointId: number;
};

export function findLocationSaveGaps(
  points: LocationPointRow[],
  minGapMinutes = 2,
): LocationSaveGap[] {
  if (points.length < 2) {
    return [];
  }

  const sorted = [...points].sort(
    (a, b) => a.timestamp.getTime() - b.timestamp.getTime(),
  );
  const minGapMs = minGapMinutes * 60_000;
  const gaps: LocationSaveGap[] = [];

  for (let index = 1; index < sorted.length; index += 1) {
    const previous = sorted[index - 1]!;
    const current = sorted[index]!;
    const durationMs =
      current.timestamp.getTime() - previous.timestamp.getTime();

    if (durationMs >= minGapMs) {
      gaps.push({
        startAt: previous.timestamp,
        endAt: current.timestamp,
        durationMs,
        afterPointId: previous.id,
        beforePointId: current.id,
      });
    }
  }

  return gaps;
}

export function formatGapDuration(durationMs: number): string {
  const totalMinutes = Math.round(durationMs / 60_000);
  if (totalMinutes < 60) {
    return `${totalMinutes} min`;
  }
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (minutes === 0) {
    return `${hours} hr`;
  }
  return `${hours} hr ${minutes} min`;
}

export function formatGapRange(gap: LocationSaveGap): string {
  return `${format(gap.startAt, 'h:mm:ss a')} → ${format(gap.endAt, 'h:mm:ss a')} (${formatGapDuration(gap.durationMs)} no saves)`;
}
