import { useEffect, useRef, useState } from 'react';
import { Modal, View } from 'react-native';
import { Heart } from 'lucide-react-native';

import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useThemeColors } from '@/hooks/use-theme-colors';
import type { HealthSyncProgress } from '@/lib/healthkit/sync';

const SMOOTH_PROGRESS_TICK_MS = 400;

type HealthSyncProgressModalProps = {
  visible: boolean;
  progress: HealthSyncProgress | null;
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

/** Ease the bar toward real progress so phase jumps feel continuous. */
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

/**
 * Blocking modal for user-initiated Apple Health backfills.
 * Not dismissible while sync runs — import is short and idempotent.
 */
export function HealthSyncProgressModal({
  visible,
  progress,
}: HealthSyncProgressModalProps) {
  const colors = useThemeColors();
  const targetPercent = progress?.percent ?? 0;
  const smoothedPercent = useSmoothedPercent(targetPercent, visible);
  const isDone = progress?.phase === 'done';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={() => undefined}
    >
      <View className="flex-1 items-center justify-center bg-black/40 px-8">
        <View className="bg-card w-full max-w-sm rounded-2xl p-5">
          <View className="items-center">
            <View className="bg-muted mb-3 h-11 w-11 items-center justify-center rounded-full">
              <Icon as={Heart} size={22} color={colors.primary} />
            </View>
            <Text className="text-center text-base font-semibold">
              {isDone ? 'Health data ready' : 'Importing Apple Health'}
            </Text>
          </View>

          <Text variant="muted" className="mt-2 text-center text-sm leading-5">
            {progress?.message ?? 'Working…'}
          </Text>

          <ProgressBar percent={smoothedPercent} />

          <Text variant="muted" className="mt-2 text-center text-xs">
            {progress?.completed != null &&
            progress.total != null &&
            progress.total > 0 &&
            progress.phase !== 'done' &&
            progress.phase !== 'preparing'
              ? `${progress.completed} / ${progress.total} · ${smoothedPercent}%`
              : `${smoothedPercent}%`}
          </Text>
        </View>
      </View>
    </Modal>
  );
}
