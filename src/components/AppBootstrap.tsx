import { useCallback, useEffect, useRef } from 'react';
import { AppState } from 'react-native';

import {
  ensureDatabaseReady,
  bootstrapLocationTracking,
} from '@/location/bootstrap';
import { getLocationService } from '@/location/transistorsoft-location-service';
import { ensureHistoryCalendarBounds } from '@/lib/history-calendar-bounds';
import { preloadTodayHistory } from '@/lib/history-preload';
import { sealYesterdayIfNeeded } from '@/lib/trip-materialization';
import { startPlaceLookupCatchUp } from '@/lib/place-lookup-catch-up';
import {
  beginTodayOpenCycle,
  scheduleTodayOpenSilentSeal,
} from '@/lib/today-sync';
import { getCurrentTripDetectionConfig } from '@/lib/trip-detection-config';
import {
  refreshTodayOnForeground,
  setTodayRefreshAppForeground,
} from '@/lib/today-refresh-scheduler';
import { runWhenIdle, yieldToEventLoop } from '@/lib/run-when-idle';
import { useAppStore } from '@/stores/app-store';

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
   * COLD START:
   * Start location as soon as the DB is open — overlaps splash for returning users.
   * Retries on foreground only when a prior bootstrap attempt failed.
   */
  useEffect(() => {
    console.log('AppBootstrap.tsx', 'useEffect', 'COLD START');
    if (!hasCompletedPrivacyOnboarding) {
      return;
    }

    let cancelSeal: (() => void) | undefined;

    void runTrackingBootstrap()
      .then(() => {
        console.log(
          'AppBootstrap.tsx',
          'useEffect',
          'runTrackingBootstrap',
          'success',
        );
        const sealWork = runWhenIdle(() => {
          console.log(
            'AppBootstrap.tsx',
            'useEffect',
            'runWhenIdle',
            'success',
          );
          void (async () => {
            console.log(
              'AppBootstrap.tsx',
              'useEffect',
              'yieldToEventLoop',
              'success',
            );
            await yieldToEventLoop();
            console.log(
              'AppBootstrap.tsx',
              'useEffect',
              'sealYesterdayIfNeeded',
              'success',
            );
            await sealYesterdayIfNeeded();
            console.log(
              'AppBootstrap.tsx',
              'useEffect',
              'yieldToEventLoop',
              'success',
            );
            await yieldToEventLoop();
            console.log(
              'AppBootstrap.tsx',
              'useEffect',
              'startPlaceLookupCatchUp',
              'success',
            );
            startPlaceLookupCatchUp();
            console.log('AppBootstrap.tsx', 'useEffect', 'success');
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
    console.log('AppBootstrap.tsx', 'useEffect', 'BEGIN TODAY OPEN CYCLE');
    beginTodayOpenCycle();

    const preload = runWhenIdle(() => {
      console.log(
        'AppBootstrap.tsx',
        'useEffect',
        'ensureHistoryCalendarBounds',
        'success',
      );
      void ensureHistoryCalendarBounds()
        .then(() => {
          console.log(
            'AppBootstrap.tsx',
            'useEffect',
            'preloadTodayHistory',
            'success',
          );
          preloadTodayHistory();
        })
        .then(() => {
          console.log(
            'AppBootstrap.tsx',
            'useEffect',
            'scheduleTodayOpenSilentSeal',
            'success',
          );
          scheduleTodayOpenSilentSeal(getCurrentTripDetectionConfig());
        })
        .catch(error => {
          logBootstrapFailure('history_preload', error);
        });
    }, DEFER_SECONDARY_LAUNCH_WORK_MS);

    return () => preload.cancel();
  }, [enableHistoryPreload, hasCompletedPrivacyOnboarding]);

  useEffect(() => {
    setTodayRefreshAppForeground(AppState.currentState === 'active');
  }, []);

  useEffect(() => {
    let currentState = AppState.currentState;
    const subscription = AppState.addEventListener('change', nextState => {
      if (nextState === currentState) {
        return;
      }
      currentState = nextState;
      setTodayRefreshAppForeground(nextState === 'active');

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
                await sealYesterdayIfNeeded();
              } catch {
                // Best-effort — map still shows cached today until sync runs.
              }
              await yieldToEventLoop();
              startPlaceLookupCatchUp();
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
