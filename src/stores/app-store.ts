import {create} from 'zustand';
import {persist, createJSONStorage} from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

import {DEFAULT_ACCENT_THEME, type AccentThemeId} from '@/lib/color-themes';
import {
  DEFAULT_TRIP_DWELL_MINUTES,
  DEFAULT_TRIP_DWELL_RADIUS_METERS,
  DEFAULT_TRIP_GAP_MINUTES,
} from '@/lib/trip-settings';

export type DistanceUnit = 'km' | 'mi';
export type PreferredMapApp = 'google' | 'apple';

type AppState = {
  hasCompletedPrivacyOnboarding: boolean;
  accentTheme: AccentThemeId;
  slowSplashEnabled: boolean;
  devShowOnboarding: boolean;
  distanceUnit: DistanceUnit;
  preferredMapApp: PreferredMapApp;
  tripGapMinutes: number;
  tripDwellMinutes: number;
  tripDwellRadiusMeters: number;
  completePrivacyOnboarding: () => void;
  setAccentTheme: (theme: AccentThemeId) => void;
  setSlowSplashEnabled: (enabled: boolean) => void;
  setDevShowOnboarding: (enabled: boolean) => void;
  setDistanceUnit: (unit: DistanceUnit) => void;
  setPreferredMapApp: (app: PreferredMapApp) => void;
  setTripGapMinutes: (minutes: number) => void;
  setTripDwellMinutes: (minutes: number) => void;
  setTripDwellRadiusMeters: (meters: number) => void;
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
      tripGapMinutes: DEFAULT_TRIP_GAP_MINUTES,
      tripDwellMinutes: DEFAULT_TRIP_DWELL_MINUTES,
      tripDwellRadiusMeters: DEFAULT_TRIP_DWELL_RADIUS_METERS,
      completePrivacyOnboarding: () => set({hasCompletedPrivacyOnboarding: true}),
      setAccentTheme: theme => set({accentTheme: theme}),
      setSlowSplashEnabled: enabled => set({slowSplashEnabled: enabled}),
      setDevShowOnboarding: enabled => set({devShowOnboarding: enabled}),
      setDistanceUnit: unit => set({distanceUnit: unit}),
      setPreferredMapApp: app => set({preferredMapApp: app}),
      setTripGapMinutes: minutes => set({tripGapMinutes: minutes}),
      setTripDwellMinutes: minutes => set({tripDwellMinutes: minutes}),
      setTripDwellRadiusMeters: meters => set({tripDwellRadiusMeters: meters}),
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
        tripGapMinutes: state.tripGapMinutes,
        tripDwellMinutes: state.tripDwellMinutes,
        tripDwellRadiusMeters: state.tripDwellRadiusMeters,
      }),
    }
  )
);
