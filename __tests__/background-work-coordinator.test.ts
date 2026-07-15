import {
  __resetBackgroundWorkCoordinatorForTests,
  requestBackgroundWorkAbort,
  startBackgroundWorkCycle,
} from '@/lib/background-work-coordinator';
import {
  clearBackgroundWorkProgress,
  getBackgroundWorkProgress,
  showBackgroundWorkBanner,
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

  it('does not start a cycle while backup owns the banner', () => {
    showBackgroundWorkBanner({
      phase: 'backup',
      message: 'Exporting your data…',
      completed: 0,
      total: 0,
    });

    startBackgroundWorkCycle();

    expect(getBackgroundWorkProgress().phase).toBe('backup');
    expect(getBackgroundWorkProgress().bannerVisible).toBe(true);
  });
});
