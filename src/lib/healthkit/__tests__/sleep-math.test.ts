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
import { resolveRoutineLookbackDays } from '@/lib/healthkit/lookback';
import { buildDaySleepRollups } from '@/lib/healthkit/day-sleep';
import { computeLifeMapSleepScore } from '@/lib/healthkit/sleep-score';
import { workoutMetaForType } from '@/lib/healthkit/workout-labels';

describe('healthkit routine lookback', () => {
  const now = new Date('2026-07-30T19:00:00.000Z');

  it('backfills when nothing has synced yet', () => {
    expect(resolveRoutineLookbackDays(null, now)).toBe(30);
  });

  it('uses the routine window for a recent sync', () => {
    expect(
      resolveRoutineLookbackDays(new Date('2026-07-30T18:50:00.000Z'), now),
    ).toBe(2);
  });

  it('widens to cover days the app was not opened', () => {
    expect(
      resolveRoutineLookbackDays(new Date('2026-07-25T19:00:00.000Z'), now),
    ).toBe(6);
  });

  it('caps the catch-up window at the backfill window', () => {
    expect(
      resolveRoutineLookbackDays(new Date('2026-01-01T19:00:00.000Z'), now),
    ).toBe(30);
  });

  it('keeps the routine window when the clock moves backward', () => {
    expect(
      resolveRoutineLookbackDays(new Date('2026-08-05T19:00:00.000Z'), now),
    ).toBe(2);
  });
});

describe('healthkit sleep score', () => {
  it('passes all NSF adult checks on a solid night with stages', () => {
    const asleepMs = 8 * 3600_000;
    const result = computeLifeMapSleepScore({
      asleepMs,
      awakeMs: 10 * 60_000,
      awakeningsOver5Min: 1,
      remMs: Math.round(asleepMs * 0.25),
      coreMs: Math.round(asleepMs * 0.57),
      deepMs: Math.round(asleepMs * 0.18),
    });
    expect(result.checksPassed).toBe(6);
    expect(result.checksTotal).toBe(6);
    expect(result.total).toBe(100);
    expect(result.band).toBe('Very High');
    expect(result.checks.find(c => c.id === 'rem')?.passed).toBe(true);
    expect(result.checks.find(c => c.id === 'deep')?.passed).toBe(true);
  });

  it('fails duration on a short nap', () => {
    const result = computeLifeMapSleepScore({
      asleepMs: 90 * 60_000,
      awakeMs: 5 * 60_000,
      awakeningsOver5Min: 0,
    });
    expect(result.checks.find(c => c.id === 'duration')?.passed).toBe(false);
    expect(result.checks.find(c => c.id === 'rem')).toBeUndefined();
  });

  it('fails WASO and efficiency when awake is very high', () => {
    const calm = computeLifeMapSleepScore({
      asleepMs: 7.5 * 3600_000,
      awakeMs: 5 * 60_000,
      awakeningsOver5Min: 0,
    });
    const restless = computeLifeMapSleepScore({
      asleepMs: 7.5 * 3600_000,
      awakeMs: 2 * 3600_000,
      awakeningsOver5Min: 4,
    });
    expect(restless.total).toBeLessThan(calm.total);
    expect(restless.checks.find(c => c.id === 'waso')?.passed).toBe(false);
    expect(restless.checks.find(c => c.id === 'efficiency')?.passed).toBe(
      false,
    );
  });

  it('marks WASO met at exactly 20 minutes', () => {
    const result = computeLifeMapSleepScore({
      asleepMs: 8 * 3600_000,
      awakeMs: 20 * 60_000,
      awakeningsOver5Min: 1,
    });
    expect(result.checks.find(c => c.id === 'waso')?.passed).toBe(true);
  });

  it('scores REM and Deep against NSF adult good ranges', () => {
    const asleepMs = 8 * 3600_000;
    const result = computeLifeMapSleepScore({
      asleepMs,
      awakeMs: 10 * 60_000,
      awakeningsOver5Min: 1,
      remMs: Math.round(asleepMs * 0.1),
      coreMs: Math.round(asleepMs * 0.82),
      deepMs: Math.round(asleepMs * 0.08),
    });
    expect(result.checks.find(c => c.id === 'rem')?.passed).toBe(false);
    expect(result.checks.find(c => c.id === 'deep')?.passed).toBe(false);
    expect(result.stages.remInNsfGoodRange).toBe(false);
    expect(result.stages.deepInNsfGoodRange).toBe(false);
  });
});

describe('healthkit day sleep rollups', () => {
  it('attributes overnight sleep to the wake day and sums stages', () => {
    const start = new Date('2026-07-29T05:30:00.000Z'); // evening local-ish
    const mid = new Date('2026-07-29T08:00:00.000Z');
    const end = new Date('2026-07-29T12:00:00.000Z');
    const rollups = buildDaySleepRollups([
      {
        uuid: 'core',
        startAt: start,
        endAt: mid,
        value: 3,
      },
      {
        uuid: 'rem',
        startAt: mid,
        endAt: end,
        value: 5,
      },
      {
        uuid: 'awake',
        startAt: new Date('2026-07-29T07:00:00.000Z'),
        endAt: new Date('2026-07-29T07:10:00.000Z'),
        value: 2,
      },
    ]);
    expect(rollups).toHaveLength(1);
    expect(rollups[0]!.coreMs).toBe(mid.getTime() - start.getTime());
    expect(rollups[0]!.remMs).toBe(end.getTime() - mid.getTime());
    expect(rollups[0]!.awakeMs).toBe(10 * 60_000);
    expect(rollups[0]!.awakeningsOver5Min).toBe(1);
    expect(rollups[0]!.asleepMs).toBe(
      rollups[0]!.coreMs + rollups[0]!.remMs,
    );
    expect(rollups[0]!.score).not.toBeNull();
  });
});

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
