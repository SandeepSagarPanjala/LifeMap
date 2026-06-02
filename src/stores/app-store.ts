import {create} from 'zustand';
import {persist, createJSONStorage} from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

import {DEFAULT_ACCENT_THEME, type AccentThemeId} from '@/lib/color-themes';

export type DistanceUnit = 'km' | 'mi';
export type PreferredMapApp = 'google' | 'apple';

type AppState = {
  hasCompletedPrivacyOnboarding: boolean;
  accentTheme: AccentThemeId;
  slowSplashEnabled: boolean;
  devShowOnboarding: boolean;
  distanceUnit: DistanceUnit;
  preferredMapApp: PreferredMapApp;
  completePrivacyOnboarding: () => void;
  setAccentTheme: (theme: AccentThemeId) => void;
  setSlowSplashEnabled: (enabled: boolean) => void;
  setDevShowOnboarding: (enabled: boolean) => void;
  setDistanceUnit: (unit: DistanceUnit) => void;
  setPreferredMapApp: (app: PreferredMapApp) => void;
};

export const useAppStore = create<AppState>()(
  persist(
    set => ({
      hasCompletedPrivacyOnboarding: false,
      accentTheme: DEFAULT_ACCENT_THEME,
      slowSplashEnabled: false,
      devShowOnboarding: false,
      distanceUnit: 'km',
      preferredMapApp: 'apple',
      completePrivacyOnboarding: () => set({hasCompletedPrivacyOnboarding: true}),
      setAccentTheme: theme => set({accentTheme: theme}),
      setSlowSplashEnabled: enabled => set({slowSplashEnabled: enabled}),
      setDevShowOnboarding: enabled => set({devShowOnboarding: enabled}),
      setDistanceUnit: unit => set({distanceUnit: unit}),
      setPreferredMapApp: app => set({preferredMapApp: app}),
    }),
    {
      name: 'lifemap-app',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: state => ({
        hasCompletedPrivacyOnboarding: state.hasCompletedPrivacyOnboarding,
        accentTheme: state.accentTheme,
        slowSplashEnabled: state.slowSplashEnabled,
        devShowOnboarding: state.devShowOnboarding,
        distanceUnit: state.distanceUnit,
        preferredMapApp: state.preferredMapApp,
      }),
    }
  )
);
