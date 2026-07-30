import {
  nextDailyFire,
  nextWeekdayFire,
  nextWeeklyFire,
  weeklySummaryLabel,
} from '../schedule-math';

describe('notification schedule-math', () => {
  it('schedules daily after now', () => {
    const from = new Date(2026, 6, 30, 10, 0, 0);
    const next = nextDailyFire(9 * 60, from);
    expect(next.getDate()).toBe(31);
    expect(next.getHours()).toBe(9);
  });

  it('skips weekend for weekdays', () => {
    // Friday 10am → next is Monday 9am
    const from = new Date(2026, 6, 31, 10, 0, 0); // Fri Jul 31 2026
    const next = nextWeekdayFire(9 * 60, from);
    expect(next.getDay()).toBe(1);
    expect(next.getHours()).toBe(9);
  });

  it('weekly uses chosen weekday', () => {
    const from = new Date(2026, 6, 30, 8, 0, 0); // Thu
    const next = nextWeeklyFire(1, 9 * 60, from); // Monday 9am
    expect(next.getDay()).toBe(1);
    expect(weeklySummaryLabel(1)).toBe('Every Monday');
  });
});
