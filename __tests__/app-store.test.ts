import {useAppStore} from '@/stores/app-store';

describe('app-store', () => {
  beforeEach(() => {
    useAppStore.setState({
      hasCompletedPrivacyOnboarding: false,
      accentTheme: 'verdant',
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
});
