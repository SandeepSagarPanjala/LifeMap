import { useCallback, useEffect, useRef } from 'react';
import { AppState } from 'react-native';

import {
  ensureDatabaseReady,
  bootstrapLocationTracking,
} from '@/location/bootstrap';
import { getLocationService } from '@/location/transistorsoft-location-service';
import { ensureHistoryCalendarBounds } from '@/lib/history-calendar-bounds';
import { preloadTodayHistory } from '@/lib/history-preload';
import { startBackgroundWorkCycle } from '@/lib/background-work-coordinator';
import {
  beginTodayOpenCycle,
} from '@/lib/today-sync';
import { sealYesterdayIfNeeded } from '@/lib/trip-materialization';
import {
  refreshTodayOnForeground,
  setTodayRefreshAppForeground,
} from '@/lib/today-refresh-scheduler';
import { runWhenIdle, yieldToEventLoop } from '@/lib/run-when-idle';
import { useAppStore } from '@/stores/app-store';

/** Defer place-lookup catch-up — not on the critical map path. */
const DEFER_PLACE_LOOKUP_MS = 2_000;

/** Let the map paint cached today before drain / tail merge on foreground resume. */
const DEFER_FOREGROUND_RESUME_MS = 100;

type AppBootstrapProps = {
  children: React.ReactNode;
};

function logPipelineFailure(scope: string, error: unknown): void {
  if (__DEV__) {
    console.error(`[LifeMap] ${scope} failed`, error);
  }
}

export function AppBootstrap({ children }: AppBootstrapProps) {
  const hasCompletedPrivacyOnboarding = useAppStore(
    state => state.hasCompletedPrivacyOnboarding,
  );
  const trackingBootstrapSucceededRef = useRef(false);
  const trackingBootstrapPromiseRef = useRef<Promise<void> | null>(null);
  const cancelForegroundResumeRef = useRef<(() => void) | null>(null);
  const coldStartPipelineStartedRef = useRef(false);

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
        logPipelineFailure('tracking_bootstrap', error);
        throw error;
      });

    trackingBootstrapPromiseRef.current = promise;
    return promise;
  }, []);

  /**
   * COLD START:
   * DB + tracking → seal yesterday → preload today (during splash) → silent seal.
   */
  useEffect(() => {
    if (!hasCompletedPrivacyOnboarding) {
      return;
    }

    if (coldStartPipelineStartedRef.current) {
      return;
    }
    coldStartPipelineStartedRef.current = true;

    let cancelBackgroundWork: (() => void) | undefined;

    void runTrackingBootstrap()
      .then(async () => {
        await yieldToEventLoop();
        beginTodayOpenCycle();
        await yieldToEventLoop();
        await ensureHistoryCalendarBounds();
        // Yesterday must be sealed before today's tail detect — lookback uses
        // excludedCrossMidnightFromMs from yesterday's materialized day.
        try {
          await sealYesterdayIfNeeded();
        } catch (error) {
          logPipelineFailure('seal_yesterday', error);
        }
        await preloadTodayHistory();
      })
      .then(() => {
        const backgroundWork = runWhenIdle(() => {
          startBackgroundWorkCycle();
        }, DEFER_PLACE_LOOKUP_MS);
        cancelBackgroundWork = backgroundWork.cancel;
      })
      .catch(error => {
        logPipelineFailure('cold_start_pipeline', error);
      });

    return () => cancelBackgroundWork?.();
  }, [hasCompletedPrivacyOnboarding, runTrackingBootstrap]);

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
              try {
                await yieldToEventLoop();
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
                try {
                  await sealYesterdayIfNeeded();
                } catch {
                  // Best-effort — still refresh today even if yesterday seal fails.
                }
                await refreshTodayOnForeground();
                startBackgroundWorkCycle();
              } catch (error) {
                logPipelineFailure('foreground_resume_pipeline', error);
              }
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
