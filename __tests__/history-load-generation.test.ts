import {
  bumpHistoryDayLoadGeneration,
  isCurrentHistoryDayLoad,
  resetHistoryLoadGenerationForTests,
} from '@/lib/history-load-generation';

describe('history load generation', () => {
  beforeEach(() => {
    resetHistoryLoadGenerationForTests();
  });

  it('marks only the latest generation as current', () => {
    const first = bumpHistoryDayLoadGeneration();
    const second = bumpHistoryDayLoadGeneration();

    expect(isCurrentHistoryDayLoad(first)).toBe(false);
    expect(isCurrentHistoryDayLoad(second)).toBe(true);
  });
});
