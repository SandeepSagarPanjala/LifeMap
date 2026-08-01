import {
  annotateStayWithSleep,
  coalesceSleepSessions,
  isAsleepSleepValue,
  overlapMs,
} from '@/lib/healthkit/sleep-math';
import {
  formatCompactSleepDuration,
  formatSleepChipLabel,
  formatSleepDetailMinutes,
  formatStepsChipLabel,
  formatVisitSleepLines,
  sleepAsleepDisplayMinutes,
} from '@/lib/healthkit/display';
import { resolveRoutineLookbackDays } from '@/lib/healthkit/lookback';
import { buildDaySleepRollups } from '@/lib/healthkit/day-sleep';
import {
  calculateSleepScore,
  computeLifeMapSleepScore,
} from '@/lib/healthkit/sleep-score';
import { buildSleepTimelineModel } from '@/lib/healthkit/sleep-timeline';
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
  it('scores a short staged night (~4.5h) in the mid-70s', () => {
    const total = calculateSleepScore({
      durationMinutes: 270,
      awakeMinutes: 8,
      remMinutes: 50,
      coreMinutes: 149,
      deepMinutes: 72,
    });
    expect(total).toBeGreaterThanOrEqual(74);
    expect(total).toBeLessThanOrEqual(78);
  });

  it('scores a textbook 8-hour night near 99', () => {
    expect(
      calculateSleepScore({
        durationMinutes: 480,
        awakeMinutes: 15,
        remMinutes: 100,
        coreMinutes: 290,
        deepMinutes: 90,
      }),
    ).toBe(99);
  });

  it('scores short sleep lower than a solid night', () => {
    const short = computeLifeMapSleepScore({
      asleepMs: 90 * 60_000,
      awakeMs: 5 * 60_000,
    });
    const solid = computeLifeMapSleepScore({
      asleepMs: 8 * 3600_000,
      awakeMs: 15 * 60_000,
      remMs: Math.round(8 * 3600_000 * 0.22),
      coreMs: Math.round(8 * 3600_000 * 0.6),
      deepMs: Math.round(8 * 3600_000 * 0.18),
    });
    expect(short.total).toBeLessThan(solid.total);
    expect(solid.total).toBeGreaterThanOrEqual(90);
    expect(solid.band).toBe('Very High');
  });

  it('penalizes very high awake time via efficiency', () => {
    const calm = computeLifeMapSleepScore({
      asleepMs: 7.5 * 3600_000,
      awakeMs: 5 * 60_000,
      remMs: Math.round(7.5 * 3600_000 * 0.22),
      deepMs: Math.round(7.5 * 3600_000 * 0.15),
      coreMs: Math.round(7.5 * 3600_000 * 0.63),
    });
    const restless = computeLifeMapSleepScore({
      asleepMs: 7.5 * 3600_000,
      awakeMs: 2 * 3600_000,
      remMs: Math.round(7.5 * 3600_000 * 0.22),
      deepMs: Math.round(7.5 * 3600_000 * 0.15),
      coreMs: Math.round(7.5 * 3600_000 * 0.63),
    });
    expect(restless.total).toBeLessThan(calm.total);
    expect(restless.efficiencyScore).toBeLessThan(calm.efficiencyScore);
  });

  it('uses timeInBedMs when larger than asleep+awake for efficiency', () => {
    const base = {
      asleepMs: 7.5 * 3600_000,
      awakeMs: 5 * 60_000,
      remMs: Math.round(7.5 * 3600_000 * 0.22),
      deepMs: Math.round(7.5 * 3600_000 * 0.15),
      coreMs: Math.round(7.5 * 3600_000 * 0.63),
    };
    const tightBed = computeLifeMapSleepScore(base);
    const longBed = computeLifeMapSleepScore({
      ...base,
      timeInBedMs: 10 * 3600_000,
    });
    expect(longBed.efficiencyScore).toBeLessThan(tightBed.efficiencyScore);
    expect(longBed.total).toBeLessThan(tightBed.total);
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
    expect(rollups[0]!.coreMs).toBe(
      mid.getTime() - start.getTime() - 10 * 60_000,
    );
    expect(rollups[0]!.remMs).toBe(end.getTime() - mid.getTime());
    expect(rollups[0]!.awakeMs).toBe(10 * 60_000);
    expect(rollups[0]!.awakeningsOver5Min).toBe(1);
    expect(rollups[0]!.asleepMs).toBe(
      rollups[0]!.coreMs + rollups[0]!.remMs,
    );
    expect(rollups[0]!.score).not.toBeNull();
  });

  it('lets staged sleep win over overlapping unspecified asleep', () => {
    const start = new Date('2026-07-30T05:00:00.000Z');
    const end = new Date('2026-07-30T09:00:00.000Z');
    const rollups = buildDaySleepRollups([
      {
        uuid: 'unspecified',
        startAt: start,
        endAt: end,
        value: 1,
      },
      {
        uuid: 'deep',
        startAt: start,
        endAt: new Date('2026-07-30T06:00:00.000Z'),
        value: 4,
      },
      {
        uuid: 'core',
        startAt: new Date('2026-07-30T06:00:00.000Z'),
        endAt: end,
        value: 3,
      },
    ]);
    expect(rollups).toHaveLength(1);
    expect(rollups[0]!.deepMs).toBe(3600_000);
    expect(rollups[0]!.coreMs).toBe(3 * 3600_000);
    expect(rollups[0]!.unspecifiedMs).toBe(0);
    expect(rollups[0]!.asleepMs).toBe(4 * 3600_000);
  });

  it('counts In Bed gaps without a stage as awake', () => {
    const bedStart = new Date('2026-07-30T04:00:00.000Z');
    const sleepStart = new Date('2026-07-30T04:30:00.000Z');
    const sleepEnd = new Date('2026-07-30T08:00:00.000Z');
    const bedEnd = new Date('2026-07-30T08:20:00.000Z');
    const rollups = buildDaySleepRollups([
      {
        uuid: 'inbed',
        startAt: bedStart,
        endAt: bedEnd,
        value: 0,
      },
      {
        uuid: 'core',
        startAt: sleepStart,
        endAt: sleepEnd,
        value: 3,
      },
    ]);
    expect(rollups).toHaveLength(1);
    expect(rollups[0]!.coreMs).toBe(sleepEnd.getTime() - sleepStart.getTime());
    expect(rollups[0]!.awakeMs).toBe(
      sleepStart.getTime() -
        bedStart.getTime() +
        (bedEnd.getTime() - sleepEnd.getTime()),
    );
    expect(rollups[0]!.asleepMs).toBe(rollups[0]!.coreMs);
  });

  it('does not double-count night + nap under a shared In Bed window', () => {
    const nightStart = new Date('2026-07-31T07:00:00.000Z'); // ~1 AM CT
    const nightEnd = new Date('2026-07-31T13:00:00.000Z'); // ~7 AM
    const napStart = new Date('2026-07-31T17:00:00.000Z'); // ~11 AM
    const napEnd = new Date('2026-07-31T19:00:00.000Z'); // ~1 PM
    const bedStart = new Date('2026-07-31T06:30:00.000Z');
    const bedEnd = new Date('2026-07-31T19:30:00.000Z');
    const rollups = buildDaySleepRollups([
      {
        uuid: 'inbed',
        startAt: bedStart,
        endAt: bedEnd,
        value: 0,
      },
      {
        uuid: 'night-core',
        startAt: nightStart,
        endAt: nightEnd,
        value: 3,
      },
      {
        uuid: 'nap-core',
        startAt: napStart,
        endAt: napEnd,
        value: 3,
      },
    ]);
    expect(rollups).toHaveLength(1);
    // One day allocation — not night+nap counted twice via expanded windows.
    expect(rollups[0]!.asleepMs).toBe(
      nightEnd.getTime() -
        nightStart.getTime() +
        (napEnd.getTime() - napStart.getTime()),
    );
    expect(rollups[0]!.coreMs).toBe(rollups[0]!.asleepMs);
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

  it('keeps detail duration aligned with summed stage minutes', () => {
    // Each stage rounds up; raw total rounds down — classic ±1 min drift.
    const remMs = Math.round(49.7 * 60_000);
    const coreMs = Math.round(148.7 * 60_000);
    const deepMs = Math.round(71.7 * 60_000);
    const unspecifiedMs = Math.round(138.7 * 60_000);
    const rawTotal = remMs + coreMs + deepMs + unspecifiedMs;
    expect(Math.round(rawTotal / 60_000)).toBe(409);
    expect(
      sleepAsleepDisplayMinutes({ remMs, coreMs, deepMs, unspecifiedMs }),
    ).toBe(410);
    expect(
      formatSleepDetailMinutes(
        sleepAsleepDisplayMinutes({ remMs, coreMs, deepMs, unspecifiedMs }),
      ),
    ).toBe('6HR 50MIN');
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

describe('healthkit sleep timeline', () => {
  it('keeps first and last labels and drops colliding middle ones', () => {
    const windowStart = new Date('2026-07-21T08:35:00.000Z'); // 3:35 AM CT
    const windowEnd = new Date('2026-07-21T17:25:00.000Z'); // 12:25 PM CT
    const model = buildSleepTimelineModel(
      [
        {
          startAt: new Date('2026-07-21T08:35:00.000Z'),
          endAt: new Date('2026-07-21T17:25:00.000Z'),
          value: 3,
        },
      ],
      windowStart,
      windowEnd,
    );

    const labels = model.ticks
      .map(t => t.label)
      .filter((label): label is string => label != null);
    expect(labels[0]).toBe('3AM');
    expect(labels.at(-1)).toBe('12PM');
    // 11AM sits too close to 12PM — must be dropped.
    expect(labels).not.toContain('11AM');
    expect(labels.filter(label => label === '12PM')).toHaveLength(1);
  });
});

describe('healthkit workout labels', () => {
  it('maps swimming and strength training', () => {
    expect(workoutMetaForType(46).label).toBe('Swimming');
    expect(workoutMetaForType(50).emoji).toBe('🏋️');
    expect(workoutMetaForType(9999).label).toBe('Workout');
  });
});
