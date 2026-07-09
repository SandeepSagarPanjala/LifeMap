import { Platform } from 'react-native';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  DEFAULT_ACCENT_THEME,
  DEFAULT_TRIP_DWELL_MINUTES,
  DEFAULT_TRIP_DWELL_RADIUS_METERS,
  type AccentThemeId,
} from '@/lib/app-constants';
import type { TripDwellMinutes, TripRadiusMeters } from '@/lib/trip-settings';

export type DistanceUnit = 'km' | 'mi';
export type PreferredMapApp = 'google' | 'apple';

const DEFAULT_PREFERRED_MAP_APP: PreferredMapApp =
  Platform.OS === 'ios' ? 'apple' : 'google';

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

function persistedAppState(state: AppState) {
  return {
    hasCompletedPrivacyOnboarding: state.hasCompletedPrivacyOnboarding,
    accentTheme: state.accentTheme,
    slowSplashEnabled: state.slowSplashEnabled,
    distanceUnit: state.distanceUnit,
    preferredMapApp: state.preferredMapApp,
    tripDwellMinutes: state.tripDwellMinutes,
    tripDwellRadiusMeters: state.tripDwellRadiusMeters,
    historyEarliestDateKey: state.historyEarliestDateKey,
    ...(__DEV__ ? { devShowOnboarding: state.devShowOnboarding } : {}),
  };
}

export const useAppStore = create<AppState>()(
  persist(
    set => ({
      hasCompletedPrivacyOnboarding: false,
      accentTheme: DEFAULT_ACCENT_THEME,
      slowSplashEnabled: false,
      devShowOnboarding: false,
      distanceUnit: 'km',
      preferredMapApp: DEFAULT_PREFERRED_MAP_APP,
      tripDwellMinutes: DEFAULT_TRIP_DWELL_MINUTES,
      tripDwellRadiusMeters: DEFAULT_TRIP_DWELL_RADIUS_METERS,
      historyEarliestDateKey: null,
      completePrivacyOnboarding: () =>
        set({ hasCompletedPrivacyOnboarding: true }),
      setAccentTheme: theme => set({ accentTheme: theme }),
      setSlowSplashEnabled: enabled => set({ slowSplashEnabled: enabled }),
      setDevShowOnboarding: enabled => {
        if (!__DEV__) {
          return;
        }
        set({ devShowOnboarding: enabled });
      },
      setDistanceUnit: unit => set({ distanceUnit: unit }),
      setPreferredMapApp: app => set({ preferredMapApp: app }),
      setTripDwellMinutes: tripDwellMinutes => set({ tripDwellMinutes }),
      setTripDwellRadiusMeters: tripDwellRadiusMeters =>
        set({ tripDwellRadiusMeters }),
      setHistoryEarliestDateKey: historyEarliestDateKey =>
        set({ historyEarliestDateKey }),
    }),
    {
      name: 'lifemap-app',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: persistedAppState,
      merge: (persisted, current) => ({
        ...current,
        ...(persisted as Partial<AppState>),
        ...(!__DEV__ ? { devShowOnboarding: false } : {}),
      }),
    },
  ),
);
