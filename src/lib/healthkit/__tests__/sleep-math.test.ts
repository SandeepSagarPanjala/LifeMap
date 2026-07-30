import {
  annotateStayWithSleep,
  coalesceSleepSessions,
  isAsleepSleepValue,
  overlapMs,
} from '@/lib/healthkit/sleep-math';
import {
  formatCompactSleepDuration,
  formatSleepChipLabel,
  formatStepsChipLabel,
  formatVisitSleepLines,
} from '@/lib/healthkit/display';
import { workoutMetaForType } from '@/lib/healthkit/workout-labels';

describe('healthkit chip labels', () => {
  it('formats compact sleep and empty chip labels', () => {
    expect(formatCompactSleepDuration(7 * 3600_000 + 25 * 60_000)).toBe(
      '7h 25m',
    );
    expect(formatCompactSleepDuration(45 * 60_000)).toBe('45m');
    expect(formatCompactSleepDuration(2 * 3600_000)).toBe('2h');
    expect(formatSleepChipLabel(null)).toBe('No data');
    expect(formatSleepChipLabel(0)).toBe('No data');
    expect(formatStepsChipLabel(null)).toBe('No data');
    expect(formatStepsChipLabel(8432)).toBe('8,432 steps');
  });
});

describe('healthkit sleep-math', () => {
  it('treats asleep stage values as asleep', () => {
    expect(isAsleepSleepValue(0)).toBe(false); // inBed
    expect(isAsleepSleepValue(2)).toBe(false); // awake
    expect(isAsleepSleepValue(1)).toBe(true);
    expect(isAsleepSleepValue(3)).toBe(true);
    expect(isAsleepSleepValue(4)).toBe(true);
    expect(isAsleepSleepValue(5)).toBe(true);
  });

  it('merges adjacent asleep samples into one session', () => {
    const sessions = coalesceSleepSessions([
      {
        uuid: 'a',
        startAt: new Date('2026-07-30T07:00:00Z'),
        endAt: new Date('2026-07-30T08:00:00Z'),
        value: 3,
      },
      {
        uuid: 'b',
        startAt: new Date('2026-07-30T08:05:00Z'),
        endAt: new Date('2026-07-30T10:00:00Z'),
        value: 4,
      },
      {
        uuid: 'c',
        startAt: new Date('2026-07-30T12:00:00Z'),
        endAt: new Date('2026-07-30T12:30:00Z'),
        value: 1,
      },
    ]);
    expect(sessions).toHaveLength(2);
    expect(sessions[0]!.startAt.toISOString()).toBe('2026-07-30T07:00:00.000Z');
    expect(sessions[0]!.endAt.toISOString()).toBe('2026-07-30T10:00:00.000Z');
    expect(sessions[1]!.startAt.toISOString()).toBe('2026-07-30T12:00:00.000Z');
  });

  it('annotates nested sleep inside a longer home stay', () => {
    const stayStart = new Date('2026-07-30T05:00:00Z'); // 12am CDT approx example times
    const stayEnd = new Date('2026-07-30T14:00:00Z'); // 9h
    const sleepStart = new Date('2026-07-30T07:00:00Z');
    const sleepEnd = new Date('2026-07-30T12:00:00Z'); // 5h
    const annotations = annotateStayWithSleep(
      stayStart,
      stayEnd,
      [{ startAt: sleepStart, endAt: sleepEnd }],
      30 * 60_000,
    );
    expect(annotations).toHaveLength(1);
    expect(annotations[0]!.durationMs).toBe(5 * 60 * 60_000);
    expect(annotations[0]!.awakeAtHomeMs).toBe(4 * 60 * 60_000);
    expect(overlapMs(stayStart, stayEnd, sleepStart, sleepEnd)).toBe(
      5 * 60 * 60_000,
    );

    const lines = formatVisitSleepLines(annotations);
    expect(lines[0]!.timeLine).toContain('Slept');
    expect(lines[0]!.durationLine).toBe('5 hr');
    expect(lines[0]).not.toHaveProperty('awakeHint');
  });
});

describe('healthkit workout labels', () => {
  it('maps swimming and strength training', () => {
    expect(workoutMetaForType(46).label).toBe('Swimming');
    expect(workoutMetaForType(50).emoji).toBe('🏋️');
    expect(workoutMetaForType(9999).label).toBe('Workout');
  });
});
