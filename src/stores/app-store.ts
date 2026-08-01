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

/** Temporary A/B for activity insights UI until one version ships. */
export type ActivityInsightsUiVersion = 'v1' | 'v2';

type AppState = {
  hasCompletedPrivacyOnboarding: boolean;
  accentTheme: AccentThemeId;
  slowSplashEnabled: boolean;
  devShowOnboarding: boolean;
  distanceUnit: DistanceUnit;
  tripDwellMinutes: TripDwellMinutes;
  tripDwellRadiusMeters: TripRadiusMeters;
  historyEarliestDateKey: string | null;
  activityInsightsUiVersion: ActivityInsightsUiVersion;
  completePrivacyOnboarding: () => void;
  setAccentTheme: (theme: AccentThemeId) => void;
  setSlowSplashEnabled: (enabled: boolean) => void;
  setDevShowOnboarding: (enabled: boolean) => void;
  setDistanceUnit: (unit: DistanceUnit) => void;
  setTripDwellMinutes: (minutes: TripDwellMinutes) => void;
  setTripDwellRadiusMeters: (meters: TripRadiusMeters) => void;
  setHistoryEarliestDateKey: (dateKey: string) => void;
  setActivityInsightsUiVersion: (version: ActivityInsightsUiVersion) => void;
};

function persistedAppState(state: AppState) {
  return {
    hasCompletedPrivacyOnboarding: state.hasCompletedPrivacyOnboarding,
    accentTheme: state.accentTheme,
    slowSplashEnabled: state.slowSplashEnabled,
    distanceUnit: state.distanceUnit,
    tripDwellMinutes: state.tripDwellMinutes,
    tripDwellRadiusMeters: state.tripDwellRadiusMeters,
    historyEarliestDateKey: state.historyEarliestDateKey,
    activityInsightsUiVersion: state.activityInsightsUiVersion,
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
      tripDwellMinutes: DEFAULT_TRIP_DWELL_MINUTES,
      tripDwellRadiusMeters: DEFAULT_TRIP_DWELL_RADIUS_METERS,
      historyEarliestDateKey: null,
      activityInsightsUiVersion: 'v1',
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
      setTripDwellMinutes: tripDwellMinutes => set({ tripDwellMinutes }),
      setTripDwellRadiusMeters: tripDwellRadiusMeters =>
        set({ tripDwellRadiusMeters }),
      setHistoryEarliestDateKey: historyEarliestDateKey =>
        set({ historyEarliestDateKey }),
      setActivityInsightsUiVersion: activityInsightsUiVersion =>
        set({ activityInsightsUiVersion }),
    }),
    {
      name: 'lifemap-app',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: persistedAppState,
      merge: (persisted, current) => {
        const fromStorage = persisted as Partial<AppState>;
        const version =
          fromStorage.activityInsightsUiVersion === 'v2' ? 'v2' : 'v1';
        return {
          ...current,
          ...fromStorage,
          activityInsightsUiVersion: version,
          ...(!__DEV__ ? { devShowOnboarding: false } : {}),
        };
      },
    },
  ),
);
