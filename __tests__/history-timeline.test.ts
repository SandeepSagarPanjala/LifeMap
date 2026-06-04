import {
  buildHistoryDayRulers,
  buildRulerTicks,
  calendarTimeToRulerPx,
  findEntryIndexAtTime,
  rulerPxToCalendarTime,
  selectionAtAnchorPx,
} from '../src/lib/history-timeline';
import type {DayTimelineEntry} from '../src/lib/trip-detection';

const BAR_WIDTH = 300;
const range = {
  startAt: new Date('2026-06-03T00:00:00'),
  endAt: new Date('2026-06-03T14:00:00'),
};

const entries: DayTimelineEntry[] = [
  {
    id: 'stay-0',
    kind: 'stay',
    points: [],
    startAt: new Date('2026-06-03T08:00:00'),
    endAt: new Date('2026-06-03T10:00:00'),
    durationMs: 2 * 3_600_000,
    distanceKm: 0,
  },
  {
    id: 'travel-1',
    kind: 'travel',
    points: [],
    startAt: new Date('2026-06-03T10:00:00'),
    endAt: new Date('2026-06-03T10:30:00'),
    durationMs: 30 * 60_000,
    distanceKm: 3,
  },
];

describe('history day rulers', () => {
  const now = new Date('2026-06-03T14:00:00');

  it('has 25 ticks (hourly) with labels every 6 hours on 12 AM scale', () => {
    const ticks = buildRulerTicks(BAR_WIDTH);
    expect(ticks).toHaveLength(25);
    expect(ticks.filter(t => t.label != null)).toHaveLength(5);
    expect(ticks[0]?.label).toBe('12 AM');
    expect(ticks[12]?.label).toBe('12 PM');
    expect(ticks[24]?.label).toBe('12 AM');
  });

  it('maps 8 AM to the correct position on midnight→midnight ruler', () => {
    const dayStart = new Date('2026-06-03T00:00:00');
    const px = calendarTimeToRulerPx(
      new Date('2026-06-03T08:00:00'),
      dayStart,
      BAR_WIDTH,
    );
    expect(px).toBeCloseTo((8 / 24) * BAR_WIDTH, 0);
  });

  it('places stay and drive segments on the day bar', () => {
    const rulers = buildHistoryDayRulers(entries, range, BAR_WIDTH, now);
    const today = rulers[rulers.length - 1]!;
    expect(today.segments).toHaveLength(2);
    expect(today.segments[0]?.kind).toBe('stay');
    expect(today.segments[1]?.kind).toBe('travel');
    expect(today.segments[0]!.leftPx).toBeLessThan(today.segments[1]!.leftPx);
  });

  it('selects drive when anchor is on the blue segment', () => {
    const rulers = buildHistoryDayRulers(entries, range, BAR_WIDTH, now);
    const today = rulers[rulers.length - 1]!;
    const drive = today.segments.find(s => s.kind === 'travel')!;
    const px = drive.leftPx + drive.widthPx / 2;
    expect(selectionAtAnchorPx(today, px, entries, BAR_WIDTH)).toBe(1);
  });

  it('returns -1 when scrub is on empty bar', () => {
    const rulers = buildHistoryDayRulers(entries, range, BAR_WIDTH, now);
    const today = rulers[rulers.length - 1]!;
    expect(selectionAtAnchorPx(today, 4, entries, BAR_WIDTH)).toBe(-1);
  });

  it('round-trips ruler position to calendar time', () => {
    const dayStart = new Date('2026-06-03T00:00:00');
    const original = new Date('2026-06-03T15:30:00');
    const px = calendarTimeToRulerPx(original, dayStart, BAR_WIDTH);
    const back = rulerPxToCalendarTime(px, dayStart, BAR_WIDTH);
    expect(back.getHours()).toBe(15);
    expect(back.getMinutes()).toBe(30);
  });
});
