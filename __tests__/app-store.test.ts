import { useAppStore } from '@/stores/app-store';

describe('app-store', () => {
  beforeEach(() => {
    useAppStore.setState({
      hasCompletedPrivacyOnboarding: false,
      accentTheme: 'verdant',
      historyEarliestDateKey: null,
      devShowOnboarding: false,
    });
  });

  it('starts with privacy onboarding incomplete', () => {
    expect(useAppStore.getState().hasCompletedPrivacyOnboarding).toBe(false);
  });

  it('completes privacy onboarding', () => {
    useAppStore.getState().completePrivacyOnboarding();
    expect(useAppStore.getState().hasCompletedPrivacyOnboarding).toBe(true);
  });

  it('defaults accent theme to verdant', () => {
    expect(useAppStore.getState().accentTheme).toBe('verdant');
  });

  it('persists accent theme selection', () => {
    useAppStore.getState().setAccentTheme('amethyst');
    expect(useAppStore.getState().accentTheme).toBe('amethyst');
  });

  it('stores history earliest date key', () => {
    useAppStore.getState().setHistoryEarliestDateKey('2024-01-15');
    expect(useAppStore.getState().historyEarliestDateKey).toBe('2024-01-15');
  });

  it('ignores dev onboarding toggle outside __DEV__', () => {
    const originalDev = (global as { __DEV__?: boolean }).__DEV__;
    (global as { __DEV__?: boolean }).__DEV__ = false;

    useAppStore.getState().setDevShowOnboarding(true);
    expect(useAppStore.getState().devShowOnboarding).toBe(false);

    (global as { __DEV__?: boolean }).__DEV__ = originalDev;
  });
});
