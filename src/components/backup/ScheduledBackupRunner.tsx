import { useCallback, useEffect, useRef, useState } from 'react';

import {
  BackupProgressModal,
  useAutoBackupDelay,
} from '@/components/backup/BackupProgressModal';
import {
  isScheduledBackupDue,
  runBackupNow,
  skipScheduledBackup,
} from '@/lib/backup/backup-service';
import { clearInterruptedBackupIfNeeded } from '@/lib/backup/backup-settings';
import { subscribeScheduledBackupForeground } from '@/lib/backup/scheduled-backup-foreground';
import type { BackupProgress } from '@/lib/backup/backup-types';

type RunnerPhase = 'idle' | 'delaying' | 'backing_up';

/**
 * Auto backup UI: delay + progress modal.
 * Triggered on BG→FG via AppBootstrap → notifyScheduledBackupOnForeground
 * (not on cold start).
 */
export function ScheduledBackupRunner() {
  const [phase, setPhase] = useState<RunnerPhase>('idle');
  const [progress, setProgress] = useState<BackupProgress | null>(null);
  const busyRef = useRef(false);

  const beginBackup = useCallback(() => {
    setPhase('backing_up');
    setProgress({
      phase: 'exporting',
      message: 'Preparing your map data',
      completedBytes: 0,
      totalBytes: 1,
    });

    void runBackupNow(setProgress)
      .catch(() => skipScheduledBackup().catch(() => undefined))
      .finally(() => {
        busyRef.current = false;
        setProgress(null);
        setPhase('idle');
      });
  }, []);

  const { remainingMs, startNow, cancel } = useAutoBackupDelay(
    phase === 'delaying',
    beginBackup,
  );

  const dismissDelay = useCallback(() => {
    cancel();
    void skipScheduledBackup().finally(() => {
      busyRef.current = false;
      setPhase('idle');
      setProgress(null);
    });
  }, [cancel]);

  useEffect(() => {
    // If a prior backup was killed mid-run, mark that schedule window as done.
    void clearInterruptedBackupIfNeeded();

    return subscribeScheduledBackupForeground(() => {
      if (busyRef.current) {
        return;
      }

      busyRef.current = true;
      void isScheduledBackupDue()
        .then(due => {
          if (!due) {
            busyRef.current = false;
            return;
          }
          setPhase('delaying');
        })
        .catch(() => {
          busyRef.current = false;
        });
    });
  }, []);

  return (
    <BackupProgressModal
      visible={phase !== 'idle'}
      progress={progress}
      title="Auto backup"
      delayMsRemaining={phase === 'delaying' ? remainingMs : null}
      onStartNow={phase === 'delaying' ? startNow : undefined}
      onDismissDelay={phase === 'delaying' ? dismissDelay : undefined}
    />
  );
}
