import { useEffect, useRef, useState } from 'react';
import { Modal, Pressable, View } from 'react-native';
import { X } from 'lucide-react-native';

import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useThemeColors } from '@/hooks/use-theme-colors';
import type { BackupProgress } from '@/lib/backup/backup-types';
import { formatStorageBytes } from '@/lib/format-storage';

export const AUTO_BACKUP_DELAY_MS = 10_000;
const SMOOTH_PROGRESS_TICK_MS = 500;

type BackupProgressModalProps = {
  visible: boolean;
  progress: BackupProgress | null;
  title: string;
  /** Countdown before auto backup starts. Null/undefined = already running. */
  delayMsRemaining?: number | null;
  onStartNow?: () => void;
  onDismissDelay?: () => void;
};

function ProgressBar({ percent }: { percent: number }) {
  const clamped = Math.min(100, Math.max(0, percent));
  return (
    <View className="bg-muted mt-4 h-2.5 w-full overflow-hidden rounded-full">
      <View
        className="bg-primary h-full rounded-full"
        style={{ width: `${clamped}%` }}
      />
    </View>
  );
}

/**
 * Ease the bar toward real progress so big step jumps feel continuous.
 * Advances at least 1% every 500ms; catches up faster when far behind.
 */
function useSmoothedPercent(targetPercent: number, active: boolean): number {
  const [displayPercent, setDisplayPercent] = useState(0);
  const targetRef = useRef(targetPercent);
  targetRef.current = targetPercent;

  useEffect(() => {
    if (!active) {
      setDisplayPercent(0);
      return;
    }

    const stepTowardTarget = (prev: number) => {
      const target = Math.min(100, Math.max(0, targetRef.current));
      if (prev >= target) {
        return target;
      }
      const gap = target - prev;
      // Minimum +1%/tick; close large gaps in a few ticks instead of minutes.
      const step = Math.max(1, Math.ceil(gap / 4));
      return Math.min(target, prev + step);
    };

    setDisplayPercent(stepTowardTarget);
    const intervalId = setInterval(() => {
      setDisplayPercent(stepTowardTarget);
    }, SMOOTH_PROGRESS_TICK_MS);

    return () => clearInterval(intervalId);
  }, [active]);

  return displayPercent;
}

export function BackupProgressModal({
  visible,
  progress,
  title,
  delayMsRemaining = null,
  onStartNow,
  onDismissDelay,
}: BackupProgressModalProps) {
  const colors = useThemeColors();
  const isDelaying =
    delayMsRemaining != null && delayMsRemaining > 0 && onStartNow != null;
  const isBackingUp = visible && !isDelaying;

  const delayPercent =
    isDelaying && delayMsRemaining != null
      ? Math.max(
          0,
          Math.min(100, (delayMsRemaining / AUTO_BACKUP_DELAY_MS) * 100),
        )
      : 0;

  const targetPercent =
    progress?.totalBytes != null &&
    progress.totalBytes > 0 &&
    progress.completedBytes != null
      ? Math.min(
          100,
          Math.round((progress.completedBytes / progress.totalBytes) * 100),
        )
      : progress?.total != null &&
        progress.total > 0 &&
        progress.completed != null
      ? Math.min(100, Math.round((progress.completed / progress.total) * 100))
      : 0;

  const smoothedPercent = useSmoothedPercent(targetPercent, isBackingUp);

  const totalBytes = progress?.totalBytes;
  const smoothedBytes =
    totalBytes != null && totalBytes > 0
      ? Math.min(totalBytes, Math.round((smoothedPercent / 100) * totalBytes))
      : null;

  const bytesLabel =
    totalBytes != null && totalBytes > 0 && smoothedBytes != null
      ? `${formatStorageBytes(smoothedBytes)} of ${formatStorageBytes(
          totalBytes,
        )}`
      : null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={isDelaying ? onDismissDelay : undefined}
    >
      <View className="flex-1 items-center justify-center bg-black/40 px-8">
        <View className="bg-card w-full rounded-2xl p-5">
          <View className="flex-row items-start">
            <Text className="flex-1 text-center text-base font-medium">
              {title}
            </Text>
            {isDelaying && onDismissDelay ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Skip auto backup"
                hitSlop={12}
                onPress={onDismissDelay}
                className="absolute right-0 top-0 p-1"
              >
                <Icon as={X} size={18} color={colors.mutedForeground} />
              </Pressable>
            ) : null}
          </View>

          {isDelaying ? (
            <>
              <Text
                variant="muted"
                className="mt-2 text-center text-sm leading-5"
              >
                Backup starts in {Math.ceil((delayMsRemaining ?? 0) / 1000)}s
              </Text>
              <Pressable
                accessibilityRole="button"
                onPress={onStartNow}
                className="bg-primary mt-4 items-center rounded-xl px-4 py-3"
              >
                <Text className="text-primary-foreground text-base font-medium">
                  Start now
                </Text>
              </Pressable>
              <ProgressBar percent={delayPercent} />
              <Text variant="muted" className="mt-2 text-center text-xs">
                {Math.round(delayPercent)}%
              </Text>
            </>
          ) : (
            <>
              <Text
                variant="muted"
                className="mt-2 text-center text-sm leading-5"
              >
                {progress?.message ?? 'Working…'}
              </Text>
              <ProgressBar percent={smoothedPercent} />
              {bytesLabel != null ? (
                <Text variant="muted" className="mt-2 text-center text-xs">
                  {bytesLabel}
                  {` · ${smoothedPercent}%`}
                </Text>
              ) : (
                <Text variant="muted" className="mt-2 text-center text-xs">
                  {smoothedPercent}%
                </Text>
              )}
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

/** Hook for the 10s auto-backup countdown. */
export function useAutoBackupDelay(
  active: boolean,
  onElapsed: () => void,
): {
  remainingMs: number;
  startNow: () => void;
  cancel: () => void;
} {
  const [remainingMs, setRemainingMs] = useState(AUTO_BACKUP_DELAY_MS);
  const onElapsedRef = useRef(onElapsed);
  onElapsedRef.current = onElapsed;
  const finishedRef = useRef(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!active) {
      setRemainingMs(AUTO_BACKUP_DELAY_MS);
      finishedRef.current = false;
      return;
    }

    finishedRef.current = false;
    setRemainingMs(AUTO_BACKUP_DELAY_MS);
    const startedAt = Date.now();
    const intervalId = setInterval(() => {
      if (finishedRef.current) {
        clearInterval(intervalId);
        return;
      }
      const left = Math.max(0, AUTO_BACKUP_DELAY_MS - (Date.now() - startedAt));
      setRemainingMs(left);
      if (left <= 0) {
        finishedRef.current = true;
        clearInterval(intervalId);
        onElapsedRef.current();
      }
    }, 100);
    intervalRef.current = intervalId;

    return () => {
      clearInterval(intervalId);
      if (intervalRef.current === intervalId) {
        intervalRef.current = null;
      }
    };
  }, [active]);

  const stopInterval = () => {
    if (intervalRef.current != null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  const startNow = () => {
    if (finishedRef.current) {
      return;
    }
    finishedRef.current = true;
    stopInterval();
    setRemainingMs(0);
    onElapsedRef.current();
  };

  const cancel = () => {
    finishedRef.current = true;
    stopInterval();
    setRemainingMs(AUTO_BACKUP_DELAY_MS);
  };

  return { remainingMs, startNow, cancel };
}
