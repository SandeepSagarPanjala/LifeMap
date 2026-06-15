import {
  beginHistoryDayLoad,
  isCurrentHistoryDayLoad,
  resetHistoryDayLoadStateForTests,
} from '@/lib/history-day-load';

describe('history day load generation', () => {
  beforeEach(() => {
    resetHistoryDayLoadStateForTests();
  });

  it('marks only the latest generation as current', () => {
    const first = beginHistoryDayLoad();
    const second = beginHistoryDayLoad();

    expect(isCurrentHistoryDayLoad(first)).toBe(false);
    expect(isCurrentHistoryDayLoad(second)).toBe(true);
  });
});
