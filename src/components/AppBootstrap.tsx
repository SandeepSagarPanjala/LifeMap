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
import { beginTodayOpenCycle } from '@/lib/today-sync';
import { sealYesterdayIfNeeded } from '@/lib/trip-materialization';
import { setTodayRefreshAppForeground } from '@/lib/today-refresh-scheduler';
import { runWhenIdle, yieldToEventLoop } from '@/lib/run-when-idle';
import { useAppStore } from '@/stores/app-store';
import { bootstrapNotifications } from '@/lib/notifications/bootstrap';
import { bootstrapHealthKit } from '@/lib/healthkit/sync';
import {
  clearHeavyResumeMapFocusSuppress,
  flushHeavyForegroundResumeIfDeferred,
  hasHeavyForegroundResumeDeferred,
  markHeavyForegroundResumeDeferred,
  startOpenGrace,
  cancelOpenGrace,
} from '@/lib/foreground-heavy-resume';
import {
  dispatchWidgetAction,
  isRootMapScreenActive,
  isWidgetCaptureAction,
  takePendingWidgetAction,
} from '@/lib/widget/widget-deep-link';

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

    void (async () => {
      try {
        await runTrackingBootstrap();
        await yieldToEventLoop();

        try {
          await bootstrapNotifications();
        } catch (error) {
          logPipelineFailure('notifications_bootstrap', error);
        }

        try {
          await bootstrapHealthKit();
        } catch (error) {
          logPipelineFailure('healthkit_bootstrap', error);
        }

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

        startOpenGrace({
          notifyBackup: false,
          onExpire: () => {
            if (hasHeavyForegroundResumeDeferred()) {
              return;
            }
            startBackgroundWorkCycle();
          },
        });
      } catch (error) {
        logPipelineFailure('cold_start_pipeline', error);
      }
    })();

    return () => cancelOpenGrace();
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
      const previousState = currentState;
      currentState = nextState;

      setTodayRefreshAppForeground(nextState === 'active');

      if (hasCompletedPrivacyOnboarding) {
        const service = getLocationService();
        /* FOREGROUND */
        if (nextState === 'active') {
          const fromBackground =
            previousState === 'background' || previousState === 'inactive';

          if (!trackingBootstrapSucceededRef.current) {
            void runTrackingBootstrap();
          }
          beginTodayOpenCycle();
          cancelForegroundResumeRef.current?.();
          const resumeWork = runWhenIdle(() => {
            void (async () => {
              try {
                const widgetAction = await takePendingWidgetAction();

                if (isWidgetCaptureAction(widgetAction)) {
                  markHeavyForegroundResumeDeferred({
                    notifyBackup: fromBackground,
                  });
                  dispatchWidgetAction(widgetAction);
                  return;
                }

                if (widgetAction != null) {
                  dispatchWidgetAction(widgetAction);
                }

                // Widget capture defers drain / persist / seal / today refresh /
                // background work / scheduled backup until Map focus (or grace expire).
                //
                // Optional safety net (disabled): flush deferred heavy on this active if the
                // user left mid-capture and never returned to Map. Re-enable only if we see
                // real stale-seal / missed-backup issues in that rare path:
                // if (hasHeavyForegroundResumeDeferred()) {
                //   await flushHeavyForegroundResumeIfDeferred({
                //     ignoreMapFocusSuppress: true,
                //   });
                //   return;
                // }
                if (hasHeavyForegroundResumeDeferred()) {
                  return;
                }

                // BG→FG: never run heavy here. Mark deferred; Map focus / grace resumes.
                // (Nav to Settings/You/capture during an on-Map grace also defers.)
                // Drain + persist run at the top of runHeavyForegroundResume.
                markHeavyForegroundResumeDeferred({
                  notifyBackup: fromBackground,
                });

                // Already on Map — focus won't re-fire, so give a 3s grace then flush.
                if (!isRootMapScreenActive()) {
                  return;
                }

                startOpenGrace({
                  notifyBackup: fromBackground,
                  onExpire: () => {
                    if (!isRootMapScreenActive()) {
                      // Left Map during grace — stay deferred until Map focus.
                      return;
                    }
                    void flushHeavyForegroundResumeIfDeferred().catch(error => {
                      logPipelineFailure('open_grace_expire', error);
                    });
                  },
                });
              } catch (error) {
                logPipelineFailure('foreground_resume_pipeline', error);
              }
            })();
          }, DEFER_FOREGROUND_RESUME_MS);
          cancelForegroundResumeRef.current = resumeWork.cancel;
        } else if (nextState === 'background') {
          cancelForegroundResumeRef.current?.();
          cancelForegroundResumeRef.current = null;
          cancelOpenGrace();
          clearHeavyResumeMapFocusSuppress();
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
