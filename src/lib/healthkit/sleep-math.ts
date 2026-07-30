import { SLEEP_MERGE_GAP_MS } from './types';

export type SleepIntervalInput = {
  uuid: string;
  startAt: Date;
  endAt: Date;
  /** HK CategoryValueSleepAnalysis numeric value. */
  value: number;
};

export type CoalescedSleepSession = {
  uuid: string;
  startAt: Date;
  endAt: Date;
};

/** Asleep values (not inBed-only, not awake). */
export function isAsleepSleepValue(value: number): boolean {
  // CategoryValueSleepAnalysis: asleepUnspecified/asleep=1, asleepCore=3, asleepDeep=4, asleepREM=5
  return value === 1 || value === 3 || value === 4 || value === 5;
}

/**
 * Merge overlapping / near-adjacent asleep samples into journal-facing sessions.
 * UUID is taken from the earliest sample in each merged group (stable enough for upserts
 * when Apple rewrites stage samples — we also key display by start/end).
 */
export function coalesceSleepSessions(
  samples: SleepIntervalInput[],
): CoalescedSleepSession[] {
  const asleep = samples
    .filter(
      s =>
        isAsleepSleepValue(s.value) &&
        s.endAt.getTime() > s.startAt.getTime(),
    )
    .sort((a, b) => a.startAt.getTime() - b.startAt.getTime());

  if (asleep.length === 0) {
    return [];
  }

  const sessions: CoalescedSleepSession[] = [];
  let current: CoalescedSleepSession = {
    uuid: `sleep:${asleep[0]!.uuid}`,
    startAt: asleep[0]!.startAt,
    endAt: asleep[0]!.endAt,
  };

  for (let i = 1; i < asleep.length; i += 1) {
    const next = asleep[i]!;
    const gap = next.startAt.getTime() - current.endAt.getTime();
    if (gap <= SLEEP_MERGE_GAP_MS) {
      if (next.endAt.getTime() > current.endAt.getTime()) {
        current = { ...current, endAt: next.endAt };
      }
      continue;
    }
    sessions.push(current);
    current = {
      uuid: `sleep:${next.uuid}`,
      startAt: next.startAt,
      endAt: next.endAt,
    };
  }
  sessions.push(current);
  return sessions;
}

export function overlapMs(
  aStart: Date,
  aEnd: Date,
  bStart: Date,
  bEnd: Date,
): number {
  const start = Math.max(aStart.getTime(), bStart.getTime());
  const end = Math.min(aEnd.getTime(), bEnd.getTime());
  return Math.max(0, end - start);
}

export type StaySleepAnnotation = {
  startAt: Date;
  endAt: Date;
  durationMs: number;
  awakeAtHomeMs: number | null;
};

/**
 * Pick sleep sessions that meaningfully overlap a stay and derive awake-at-home hint.
 */
export function annotateStayWithSleep(
  stayStart: Date,
  stayEnd: Date,
  sessions: Array<{ startAt: Date; endAt: Date }>,
  minOverlapMs: number,
): StaySleepAnnotation[] {
  const stayMs = Math.max(0, stayEnd.getTime() - stayStart.getTime());
  const out: StaySleepAnnotation[] = [];

  for (const session of sessions) {
    const overlap = overlapMs(
      stayStart,
      stayEnd,
      session.startAt,
      session.endAt,
    );
    if (overlap < minOverlapMs) {
      continue;
    }
    const durationMs = Math.max(
      0,
      session.endAt.getTime() - session.startAt.getTime(),
    );
    const awakeAtHomeMs =
      stayMs > 0 && stayMs - overlap >= 15 * 60_000
        ? stayMs - overlap
        : null;
    out.push({
      startAt: session.startAt,
      endAt: session.endAt,
      durationMs,
      awakeAtHomeMs,
    });
  }

  return out.sort((a, b) => a.startAt.getTime() - b.startAt.getTime());
}
