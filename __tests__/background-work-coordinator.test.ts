import {
  __resetBackgroundWorkCoordinatorForTests,
  requestBackgroundWorkAbort,
} from '@/lib/background-work-coordinator';
import {
  clearBackgroundWorkProgress,
  getBackgroundWorkProgress,
} from '@/lib/background-work-events';

describe('background-work coordinator', () => {
  beforeEach(() => {
    __resetBackgroundWorkCoordinatorForTests();
  });

  it('requestBackgroundWorkAbort clears after reset', () => {
    requestBackgroundWorkAbort();
    __resetBackgroundWorkCoordinatorForTests();
    expect(getBackgroundWorkProgress().bannerVisible).toBe(false);
  });

  it('starts with idle progress', () => {
    clearBackgroundWorkProgress();
    expect(getBackgroundWorkProgress()).toEqual({
      phase: 'idle',
      message: '',
      completed: 0,
      total: 0,
      bannerVisible: false,
    });
  });
});
