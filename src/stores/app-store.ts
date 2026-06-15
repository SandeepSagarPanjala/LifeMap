import {create} from 'zustand';
import {persist, createJSONStorage} from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

import {DEFAULT_ACCENT_THEME, type AccentThemeId} from '@/lib/color-themes';
import {
  DEFAULT_TRIP_DWELL_MINUTES,
  DEFAULT_TRIP_DWELL_RADIUS_METERS,
  type TripDwellMinutes,
  type TripRadiusMeters,
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
  tripDwellMinutes: TripDwellMinutes;
  tripDwellRadiusMeters: TripRadiusMeters;
  historyEarliestDateKey: string | null;
  completePrivacyOnboarding: () => void;
  setAccentTheme: (theme: AccentThemeId) => void;
  setSlowSplashEnabled: (enabled: boolean) => void;
  setDevShowOnboarding: (enabled: boolean) => void;
  setDistanceUnit: (unit: DistanceUnit) => void;
  setPreferredMapApp: (app: PreferredMapApp) => void;
  setTripDwellMinutes: (minutes: TripDwellMinutes) => void;
  setTripDwellRadiusMeters: (meters: TripRadiusMeters) => void;
  setHistoryEarliestDateKey: (dateKey: string) => void;
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
      tripDwellMinutes: DEFAULT_TRIP_DWELL_MINUTES,
      tripDwellRadiusMeters: DEFAULT_TRIP_DWELL_RADIUS_METERS,
      historyEarliestDateKey: null,
      completePrivacyOnboarding: () => set({hasCompletedPrivacyOnboarding: true}),
      setAccentTheme: theme => set({accentTheme: theme}),
      setSlowSplashEnabled: enabled => set({slowSplashEnabled: enabled}),
      setDevShowOnboarding: enabled => set({devShowOnboarding: enabled}),
      setDistanceUnit: unit => set({distanceUnit: unit}),
      setPreferredMapApp: app => set({preferredMapApp: app}),
      setTripDwellMinutes: tripDwellMinutes => set({tripDwellMinutes}),
      setTripDwellRadiusMeters: tripDwellRadiusMeters =>
        set({tripDwellRadiusMeters}),
      setHistoryEarliestDateKey: historyEarliestDateKey =>
        set({historyEarliestDateKey}),
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
        tripDwellMinutes: state.tripDwellMinutes,
        tripDwellRadiusMeters: state.tripDwellRadiusMeters,
      }),
    }
  )
);
