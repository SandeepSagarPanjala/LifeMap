import {
  formatStayVisitLabel,
  formatTimelineTitle,
  formatTripTimeRange,
  formatVisitTimeRange,
} from '../src/lib/trip-format';

describe('formatStayVisitLabel', () => {
  const start = new Date('2026-06-04T09:11:00.000Z'); // 4:11 AM CDT
  const end = new Date('2026-06-04T09:18:00.000Z');
  const now = new Date('2026-06-04T10:28:00.000Z'); // 5:28 AM CDT

  it('shows actual end time for finished visits', () => {
    const label = formatStayVisitLabel(start, end, 7 * 60_000, { now });
    expect(label.title).toBe('4:11 AM to 4:18 AM');
    expect(label.subtitle).toBe('7 min');
    expect(label.statusLine).toBeUndefined();
  });

  it('shows now as end only for open visit', () => {
    const label = formatStayVisitLabel(start, now, 77 * 60_000, {
      openThroughNow: true,
      now,
    });
    expect(label.title).toBe('4:11 AM to 5:28 AM');
    expect(label.subtitle).toBe('1 hr 17 min');
    expect(label.statusLine).toBe('Still here');
  });

  it('keeps open-visit end time and duration on the same minute', () => {
    const midnight = new Date('2026-07-01T05:00:00.000Z'); // 12:00 AM CDT
    const now = new Date('2026-07-01T11:31:45.000Z'); // 6:31:45 AM CDT
    const label = formatStayVisitLabel(midnight, now, 0, {
      openThroughNow: true,
      now,
    });
    expect(label.title).toBe('12:00 AM to 6:31 AM');
    expect(label.subtitle).toBe('6 hr 31 min');
    expect(label.statusLine).toBe('Still here');
  });

  it('does not stretch a recently ended visit when it is closed', () => {
    const visitEnd = new Date('2026-06-04T10:34:00.000Z'); // 5:34 AM CDT
    const label = formatStayVisitLabel(start, visitEnd, 60_000, {
      openThroughNow: false,
      now,
    });
    expect(label.title).toBe('4:11 AM to 5:34 AM');
    expect(label.subtitle).toBe('1 min');
    expect(label.statusLine).toBeUndefined();
  });
});

describe('formatVisitTimeRange', () => {
  it('does not substitute now unless passed', () => {
    const start = new Date('2026-06-04T05:00:00.000Z');
    const end = new Date('2026-06-04T09:04:00.000Z');
    expect(formatVisitTimeRange(start, end)).toBe('12:00 AM to 4:04 AM');
  });
});

describe('formatTripTimeRange', () => {
  it('shows the end date when a drive crosses midnight', () => {
    const start = new Date('2026-06-08T04:42:00.000Z'); // 11:42 PM Jun 7 CDT
    const end = new Date('2026-06-08T05:19:00.000Z'); // 12:19 AM Jun 8 CDT
    expect(formatTripTimeRange(start, end)).toBe('11:42 PM – Jun 8, 12:19 AM');
  });
});

describe('formatTimelineTitle', () => {
  it('shows cross-day drive times from entry start and end', () => {
    const title = formatTimelineTitle({
      id: 'travel-0',
      kind: 'travel',
      points: [],
      startAt: new Date('2026-06-08T04:51:00.000Z'),
      endAt: new Date('2026-06-08T05:20:00.000Z'),
      distanceKm: 1,
      durationMs: 29 * 60_000,
    });
    expect(title).toBe('11:51 PM – Jun 8, 12:20 AM');
  });
});
