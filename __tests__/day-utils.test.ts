import { followTodayDateKeyRoll, parseDateKey } from '../src/lib/day-utils';
import { formatMapDateLabel } from '../src/lib/history-timeline';

describe('followTodayDateKeyRoll', () => {
  it('follows the new calendar day when the map was showing prior today', () => {
    expect(
      followTodayDateKeyRoll('2026-06-10', '2026-06-10', '2026-06-11'),
    ).toBe('2026-06-11');
  });

  it('keeps a manually selected historical day after midnight', () => {
    expect(
      followTodayDateKeyRoll('2026-06-09', '2026-06-10', '2026-06-11'),
    ).toBe('2026-06-09');
  });

  it('keeps yesterday when browsing history on the current day', () => {
    expect(
      followTodayDateKeyRoll('2026-06-10', '2026-06-11', '2026-06-11'),
    ).toBe('2026-06-10');
  });
});

describe('formatMapDateLabel', () => {
  const referenceNow = parseDateKey('2026-06-11');

  it('labels the current calendar day as Today with the date', () => {
    expect(formatMapDateLabel('2026-06-11', '2026-06-11', referenceNow)).toBe(
      'Today · Jun 11',
    );
  });

  it('labels a selected historical day with weekday and date', () => {
    expect(formatMapDateLabel('2026-06-10', '2026-06-11', referenceNow)).toBe(
      'Wed · Jun 10',
    );
  });
});
