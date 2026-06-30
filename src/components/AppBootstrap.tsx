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
import {runWhenIdle, yieldToEventLoop} from '@/lib/run-when-idle';
import {useAppStore} from '@/stores/app-store';

/** Defer timeline preload and yesterday seal — not location tracking. */
const DEFER_SECONDARY_LAUNCH_WORK_MS = 2_000;

type AppBootstrapProps = {
  children: React.ReactNode;
  /** When false, defer today's history preload until the main app is visible. */
  enableHistoryPreload?: boolean;
};

export function AppBootstrap({
  children,
  enableHistoryPreload = false,
}: AppBootstrapProps) {
  const hasCompletedPrivacyOnboarding = useAppStore(
    state => state.hasCompletedPrivacyOnboarding,
  );

  /**
   * Start location as soon as the DB is open — overlaps splash for returning users.
   * bootstrapLocationTracking() is a singleton; safe if called again after onboarding.
   */
  useEffect(() => {
    if (!hasCompletedPrivacyOnboarding) {
      return;
    }

    let cancelSeal: (() => void) | undefined;

    void ensureDatabaseReady().then(async () => {
      await warmCanonicalTravelGeometrySetting();
      void bootstrapLocationTracking();

      const sealWork = runWhenIdle(() => {
        void (async () => {
          await yieldToEventLoop();
          await sealYesterdayIfNeeded();
        })();
      }, DEFER_SECONDARY_LAUNCH_WORK_MS);
      cancelSeal = sealWork.cancel;
    });

    return () => cancelSeal?.();
  }, [hasCompletedPrivacyOnboarding]);

  useEffect(() => {
    if (!enableHistoryPreload || !hasCompletedPrivacyOnboarding) {
      return;
    }

    const preload = runWhenIdle(() => {
      void ensureHistoryCalendarBounds().then(() => {
        void preloadTodayHistory();
      });
    }, DEFER_SECONDARY_LAUNCH_WORK_MS);

    return () => preload.cancel();
  }, [enableHistoryPreload, hasCompletedPrivacyOnboarding]);

  useEffect(() => {
    initializeTrackingDiagnosticsEnabled();
  }, []);

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

      if (hasCompletedPrivacyOnboarding) {
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
  }, [hasCompletedPrivacyOnboarding]);

  return children;
}
