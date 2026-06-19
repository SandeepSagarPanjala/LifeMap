import {useEffect} from 'react';
import {AppState} from 'react-native';

import {ensureDatabaseReady, bootstrapLocationTracking} from '@/location/bootstrap';
import {getLocationService} from '@/location/transistorsoft-location-service';
import {
  initializeTrackingDiagnosticsEnabled,
  recordTrackingDiagnostic,
} from '@/lib/tracking-diagnostics';
import {ensureHistoryCalendarBounds} from '@/lib/history-calendar-bounds';
import {preloadTodayHistory} from '@/lib/history-preload';
import {sealYesterdayIfNeeded} from '@/lib/trip-materialization';
import {warmCanonicalTravelGeometrySetting} from '@/lib/trip-geometry-settings';
import {useAppStore} from '@/stores/app-store';

type AppBootstrapProps = {
  children: React.ReactNode;
  /** When false, only the encrypted database is initialized. */
  enableLocationTracking?: boolean;
  /** When false, defer today's history preload until the main app is visible. */
  enableHistoryPreload?: boolean;
};

export function AppBootstrap({
  children,
  enableLocationTracking = false,
  enableHistoryPreload = false,
}: AppBootstrapProps) {
  const hasCompletedPrivacyOnboarding = useAppStore(
    state => state.hasCompletedPrivacyOnboarding,
  );

  useEffect(() => {
    void ensureDatabaseReady().then(async () => {
      await warmCanonicalTravelGeometrySetting();
      await sealYesterdayIfNeeded();
    });
  }, []);

  useEffect(() => {
    if (!enableHistoryPreload || !hasCompletedPrivacyOnboarding) {
      return;
    }
    void ensureHistoryCalendarBounds().then(() => {
      void preloadTodayHistory();
    });
  }, [enableHistoryPreload, hasCompletedPrivacyOnboarding]);

  useEffect(() => {
    initializeTrackingDiagnosticsEnabled();
  }, []);

  useEffect(() => {
    if (!enableLocationTracking || !hasCompletedPrivacyOnboarding) {
      return;
    }

    void bootstrapLocationTracking();
  }, [enableLocationTracking, hasCompletedPrivacyOnboarding]);

  useEffect(() => {
    let currentState = AppState.currentState;
    const subscription = AppState.addEventListener('change', nextState => {
      if (nextState === currentState) {
        return;
      }
      const previous = currentState;
      currentState = nextState;
      void recordTrackingDiagnostic('app_state_change', {
        previous,
        next: nextState,
      });

      if (enableLocationTracking && hasCompletedPrivacyOnboarding) {
        const service = getLocationService();
        if (nextState === 'active') {
          void warmCanonicalTravelGeometrySetting().then(() =>
            sealYesterdayIfNeeded(),
          );
          void service.refreshPersistPipeline().catch(() => undefined);
        } else if (nextState === 'background') {
          void service.drainNativeQueue().catch(() => undefined);
        }
      }
    });
    return () => subscription.remove();
  }, [enableLocationTracking, hasCompletedPrivacyOnboarding]);

  return children;
}
