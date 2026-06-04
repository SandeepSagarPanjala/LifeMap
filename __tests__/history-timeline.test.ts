import {
  ANCHOR_SIZE_PX,
  buildHistoryDayRulers,
  calendarTimeToRulerPx,
  countHistoryTimelineEvents,
  dedupeMajorTickLabels,
  layoutSegmentsOnFixedBar,
  rulerPxToCalendarTime,
  selectionAtAnchorPx,
  type HistoryRulerTick,
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

  it('maps 8 AM to the correct position on linear midnight scale', () => {
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
    expect(today.barWidthPx).toBe(BAR_WIDTH);
  });

  it('selects drive when anchor is on the blue segment', () => {
    const rulers = buildHistoryDayRulers(entries, range, BAR_WIDTH, now);
    const today = rulers[rulers.length - 1]!;
    const drive = today.segments.find(s => s.kind === 'travel')!;
    const px = drive.leftPx + drive.widthPx / 2;
    expect(selectionAtAnchorPx(today, px, entries)).toBe(1);
  });

  it('counts visits and drives for the history badge', () => {
    expect(countHistoryTimelineEvents(entries)).toBe(2);
  });

  it('hides overlapping major tick labels on compressed bars', () => {
    const ticks: HistoryRulerTick[] = [
      {hour: 0, leftPx: 0, label: '12 AM', kind: 'major'},
      {hour: 24, leftPx: 2, label: '12 AM', kind: 'major'},
      {hour: 12, leftPx: 150, label: '12 PM', kind: 'major'},
    ];
    const deduped = dedupeMajorTickLabels(ticks, 40);
    const labels = deduped.filter(t => t.label).map(t => t.hour);
    expect(labels).toContain(0);
    expect(labels).not.toContain(24);
  });

  it('returns -1 when scrub is on empty bar', () => {
    const rulers = buildHistoryDayRulers([], range, BAR_WIDTH, now);
    const today = rulers[rulers.length - 1]!;
    expect(selectionAtAnchorPx(today, BAR_WIDTH / 2, [])).toBe(-1);
  });

  it('selects nearest segment when anchor is past the last segment', () => {
    const rulers = buildHistoryDayRulers(entries, range, BAR_WIDTH, now);
    const today = rulers[rulers.length - 1]!;
    const drive = today.segments.find(s => s.kind === 'travel')!;
    const pastEnd = drive.leftPx + drive.widthPx + 8;
    expect(selectionAtAnchorPx(today, pastEnd, entries)).toBe(1);
  });

  it('gives each visit/drive at least scrub-handle width on a fixed bar', () => {
    const shortDrive: DayTimelineEntry = {
      id: 'travel-short',
      kind: 'travel',
      points: [],
      startAt: new Date('2026-06-03T10:00:00'),
      endAt: new Date('2026-06-03T10:05:00'),
      durationMs: 5 * 60_000,
      distanceKm: 1,
    };
    const rulers = buildHistoryDayRulers(
      [entries[0]!, shortDrive],
      range,
      BAR_WIDTH,
      now,
    );
    const today = rulers[rulers.length - 1]!;
    const drive = today.segments.find(s => s.kind === 'travel')!;
    expect(drive!.widthPx).toBeGreaterThanOrEqual(ANCHOR_SIZE_PX);
    expect(today.barWidthPx).toBe(BAR_WIDTH);
    const totalWidth = today.segments.reduce((s, seg) => s + seg.widthPx, 0);
    expect(totalWidth).toBeCloseTo(BAR_WIDTH, 0);
  });

  it('layoutSegmentsOnFixedBar packs segments to full bar width', () => {
    const laid = layoutSegmentsOnFixedBar(
      [
        {
          entryIndex: 0,
          kind: 'stay',
          startAt: new Date('2026-06-03T08:00:00'),
          endAt: new Date('2026-06-03T10:00:00'),
          leftPx: 0,
          widthPx: 0,
        },
        {
          entryIndex: 1,
          kind: 'travel',
          startAt: new Date('2026-06-03T10:00:00'),
          endAt: new Date('2026-06-03T10:05:00'),
          leftPx: 0,
          widthPx: 0,
        },
      ],
      BAR_WIDTH,
    );
    expect(laid[0]!.widthPx).toBeGreaterThanOrEqual(ANCHOR_SIZE_PX);
    expect(laid[1]!.widthPx).toBeGreaterThanOrEqual(ANCHOR_SIZE_PX);
    expect(laid[0]!.leftPx + laid[0]!.widthPx).toBeCloseTo(laid[1]!.leftPx, 0);
    expect(laid[1]!.leftPx + laid[1]!.widthPx).toBeCloseTo(BAR_WIDTH, 0);
  });

  it('maps hour labels through event layout (compressed gaps)', () => {
    const rulers = buildHistoryDayRulers(entries, range, BAR_WIDTH, now);
    const today = rulers[rulers.length - 1]!;
    const nineAm = today.ticks.find(t => t.hour === 9);
    expect(nineAm?.label).toBeNull();
    expect(nineAm!.leftPx).toBeGreaterThan(0);
    expect(nineAm!.leftPx).toBeLessThan(BAR_WIDTH);
  });

  it('round-trips linear ruler position to calendar time', () => {
    const dayStart = new Date('2026-06-03T00:00:00');
    const original = new Date('2026-06-03T15:30:00');
    const px = calendarTimeToRulerPx(original, dayStart, BAR_WIDTH);
    const back = rulerPxToCalendarTime(px, dayStart, BAR_WIDTH);
    expect(back.getHours()).toBe(15);
    expect(back.getMinutes()).toBe(30);
  });
});
