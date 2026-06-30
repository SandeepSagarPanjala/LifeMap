import {useEffect, useRef, useState} from 'react';
import {AppState} from 'react-native';

import {BackupProgressModal} from '@/components/backup/BackupProgressModal';
import {maybeRunScheduledBackup} from '@/lib/backup/backup-service';
import type {BackupProgress} from '@/lib/backup/backup-types';

/**
 * Runs daily/weekly auto backup when the app returns to foreground (not on cold start).
 * Shows a progress modal while uploading.
 */
export function ScheduledBackupRunner() {
  const [progress, setProgress] = useState<BackupProgress | null>(null);
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

      void maybeRunScheduledBackup(setProgress)
        .catch(() => undefined)
        .finally(() => {
          runningRef.current = false;
          setProgress(null);
        });
    });

    return () => subscription.remove();
  }, []);

  return (
    <BackupProgressModal
      visible={progress != null}
      progress={progress}
      title="Auto backup"
    />
  );
}
