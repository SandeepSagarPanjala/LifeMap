import {
  formatStayVisitLabel,
  formatVisitTimeRange,
} from '../src/lib/trip-format';

describe('formatStayVisitLabel', () => {
  const start = new Date('2026-06-04T09:11:00.000Z'); // 4:11 AM CDT
  const end = new Date('2026-06-04T09:18:00.000Z');
  const now = new Date('2026-06-04T10:28:00.000Z'); // 5:28 AM CDT

  it('shows actual end time for finished visits', () => {
    const label = formatStayVisitLabel(start, end, 7 * 60_000, {now});
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
    expect(label.statusLine).toBe('Still here');
  });
});

describe('formatVisitTimeRange', () => {
  it('does not substitute now unless passed', () => {
    const start = new Date('2026-06-04T05:00:00.000Z');
    const end = new Date('2026-06-04T09:04:00.000Z');
    expect(formatVisitTimeRange(start, end)).toBe('12:00 AM to 4:04 AM');
  });
});
