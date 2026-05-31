import {create} from 'zustand';
import {persist, createJSONStorage} from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

import {DEFAULT_ACCENT_THEME, type AccentThemeId} from '@/lib/color-themes';

type AppState = {
  hasCompletedPrivacyOnboarding: boolean;
  accentTheme: AccentThemeId;
  completePrivacyOnboarding: () => void;
  setAccentTheme: (theme: AccentThemeId) => void;
};

export const useAppStore = create<AppState>()(
  persist(
    set => ({
      hasCompletedPrivacyOnboarding: false,
      accentTheme: DEFAULT_ACCENT_THEME,
      completePrivacyOnboarding: () => set({hasCompletedPrivacyOnboarding: true}),
      setAccentTheme: theme => set({accentTheme: theme}),
    }),
    {
      name: 'lifemap-app',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: state => ({
        hasCompletedPrivacyOnboarding: state.hasCompletedPrivacyOnboarding,
        accentTheme: state.accentTheme,
      }),
    }
  )
);
