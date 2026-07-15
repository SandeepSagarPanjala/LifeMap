import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';

import { maybeRunScheduledBackup } from '@/lib/backup/backup-service';
import type { BackupProgress } from '@/lib/backup/backup-types';
import { waitUntilBackgroundWorkCycleSettled } from '@/lib/background-work-coordinator';
import {
  clearBackgroundWorkProgress,
  getBackgroundWorkProgress,
  setBackgroundWorkProgress,
  showBackgroundWorkBanner,
} from '@/lib/background-work-events';

function publishBackupProgress(progress: BackupProgress): void {
  const completed = progress.completed ?? 0;
  const total = progress.total ?? 0;
  const current = getBackgroundWorkProgress();

  if (!current.bannerVisible || current.phase !== 'backup') {
    showBackgroundWorkBanner({
      phase: 'backup',
      message: progress.message,
      completed,
      total,
    });
    return;
  }

  setBackgroundWorkProgress({
    phase: 'backup',
    message: progress.message,
    completed,
    total,
  });
}

/**
 * Runs daily/weekly auto backup when the app returns to foreground (not on cold start).
 * Progress uses the shared background-work banner (non-blocking).
 */
export function ScheduledBackupRunner() {
  const runningRef = useRef(false);

  useEffect(() => {
    let currentState = AppState.currentState;

    const subscription = AppState.addEventListener('change', nextState => {
      const wasBackground =
        currentState === 'background' || currentState === 'inactive';
      currentState = nextState;

      if (nextState !== 'active' || !wasBackground || runningRef.current) {
        return;
      }

      runningRef.current = true;

      void (async () => {
        try {
          await waitUntilBackgroundWorkCycleSettled();
          if (AppState.currentState !== 'active') {
            return;
          }
          await maybeRunScheduledBackup(publishBackupProgress);
        } catch {
          // Best-effort — next FG will retry if still due.
        } finally {
          if (getBackgroundWorkProgress().phase === 'backup') {
            clearBackgroundWorkProgress();
          }
          runningRef.current = false;
        }
      })();
    });

    return () => subscription.remove();
  }, []);

  return null;
}
