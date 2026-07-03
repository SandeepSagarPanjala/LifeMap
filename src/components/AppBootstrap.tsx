import {useCallback, useEffect, useRef} from 'react';
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
import {
  beginTodayOpenCycle,
  scheduleTodayOpenSilentSeal,
} from '@/lib/today-sync';
import {getCurrentTripDetectionConfig} from '@/lib/trip-detection-config';
import {refreshTodayOnForeground, setTodayRefreshAppForeground} from '@/lib/today-refresh-scheduler';
import {warmCanonicalTravelGeometrySetting} from '@/lib/trip-geometry-settings';
import {runWhenIdle, yieldToEventLoop} from '@/lib/run-when-idle';
import {useAppStore} from '@/stores/app-store';

/** Defer timeline preload and yesterday seal — not location tracking. */
const DEFER_SECONDARY_LAUNCH_WORK_MS = 2_000;

/** Let the map paint cached today before drain / tail merge on foreground resume. */
const DEFER_FOREGROUND_RESUME_MS = 100;

type AppBootstrapProps = {
  children: React.ReactNode;
  /** When false, defer today's history preload until the main app is visible. */
  enableHistoryPreload?: boolean;
};

function logBootstrapFailure(scope: string, error: unknown): void {
  if (__DEV__) {
    console.error(`[LifeMap] ${scope} failed`, error);
  }
  void recordTrackingDiagnostic('bootstrap_failed', {
    scope,
    message: error instanceof Error ? error.message : 'unknown',
  });
}

export function AppBootstrap({
  children,
  enableHistoryPreload = false,
}: AppBootstrapProps) {
  const hasCompletedPrivacyOnboarding = useAppStore(
    state => state.hasCompletedPrivacyOnboarding,
  );
  const trackingBootstrapSucceededRef = useRef(false);
  const trackingBootstrapPromiseRef = useRef<Promise<void> | null>(null);
  const cancelForegroundResumeRef = useRef<(() => void) | null>(null);

  const runTrackingBootstrap = useCallback((): Promise<void> => {
    if (trackingBootstrapSucceededRef.current) {
      return Promise.resolve();
    }
    if (trackingBootstrapPromiseRef.current) {
      return trackingBootstrapPromiseRef.current;
    }

    const promise = ensureDatabaseReady()
      .then(async () => {
        await warmCanonicalTravelGeometrySetting();
        await bootstrapLocationTracking();
        trackingBootstrapSucceededRef.current = true;
      })
      .catch(error => {
        trackingBootstrapPromiseRef.current = null;
        logBootstrapFailure('tracking_bootstrap', error);
        throw error;
      });

    trackingBootstrapPromiseRef.current = promise;
    return promise;
  }, []);

  /**
   * Start location as soon as the DB is open — overlaps splash for returning users.
   * Retries on foreground only when a prior bootstrap attempt failed.
   */
  useEffect(() => {
    if (!hasCompletedPrivacyOnboarding) {
      return;
    }

    let cancelSeal: (() => void) | undefined;

    void runTrackingBootstrap()
      .then(() => {
        const sealWork = runWhenIdle(() => {
          void (async () => {
            await yieldToEventLoop();
            await sealYesterdayIfNeeded();
          })();
        }, DEFER_SECONDARY_LAUNCH_WORK_MS);
        cancelSeal = sealWork.cancel;
      })
      .catch(() => undefined);

    return () => cancelSeal?.();
  }, [hasCompletedPrivacyOnboarding, runTrackingBootstrap]);

  useEffect(() => {
    if (!enableHistoryPreload || !hasCompletedPrivacyOnboarding) {
      return;
    }

    beginTodayOpenCycle();

    const preload = runWhenIdle(() => {
      void ensureHistoryCalendarBounds()
        .then(() => preloadTodayHistory())
        .then(() => {
          scheduleTodayOpenSilentSeal(getCurrentTripDetectionConfig());
        })
        .catch(error => {
          logBootstrapFailure('history_preload', error);
        });
    }, DEFER_SECONDARY_LAUNCH_WORK_MS);

    return () => preload.cancel();
  }, [enableHistoryPreload, hasCompletedPrivacyOnboarding]);

  useEffect(() => {
    initializeTrackingDiagnosticsEnabled();
    setTodayRefreshAppForeground(AppState.currentState === 'active');
  }, []);

  useEffect(() => {
    let currentState = AppState.currentState;
    const subscription = AppState.addEventListener('change', nextState => {
      if (nextState === currentState) {
        return;
      }
      const previous = currentState;
      currentState = nextState;
      setTodayRefreshAppForeground(nextState === 'active');
      void recordTrackingDiagnostic('app_state_change', {
        previous,
        next: nextState,
      });

      if (hasCompletedPrivacyOnboarding) {
        const service = getLocationService();
        if (nextState === 'active') {
          if (!trackingBootstrapSucceededRef.current) {
            void runTrackingBootstrap();
          }
          beginTodayOpenCycle();
          cancelForegroundResumeRef.current?.();
          const resumeWork = runWhenIdle(() => {
            void (async () => {
              await yieldToEventLoop();
              try {
                await warmCanonicalTravelGeometrySetting();
                await sealYesterdayIfNeeded();
              } catch {
                // Best-effort — map still shows cached today until sync runs.
              }
              try {
                await service.drainNativeQueue();
              } catch {
                // Best-effort — persist pipeline may still have rows in SQLite.
              }
              try {
                await service.refreshPersistPipeline();
              } catch {
                // Best-effort — still refresh the map from whatever is in the DB.
              }
              refreshTodayOnForeground();
              scheduleTodayOpenSilentSeal(getCurrentTripDetectionConfig());
            })();
          }, DEFER_FOREGROUND_RESUME_MS);
          cancelForegroundResumeRef.current = resumeWork.cancel;
        } else if (nextState === 'background') {
          cancelForegroundResumeRef.current?.();
          cancelForegroundResumeRef.current = null;
          void service.drainNativeQueue().catch(() => undefined);
        }
      }
    });
    return () => {
      cancelForegroundResumeRef.current?.();
      subscription.remove();
    };
  }, [hasCompletedPrivacyOnboarding, runTrackingBootstrap]);

  return children;
}
