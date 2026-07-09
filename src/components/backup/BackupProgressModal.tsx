import { ActivityIndicator, Modal, View } from 'react-native';

import { Text } from '@/components/ui/text';
import type { BackupProgress } from '@/lib/backup/backup-types';

type BackupProgressModalProps = {
  visible: boolean;
  progress: BackupProgress | null;
  title: string;
};

export function BackupProgressModal({
  visible,
  progress,
  title,
}: BackupProgressModalProps) {
  const percent =
    progress?.total != null && progress.total > 0 && progress.completed != null
      ? Math.round((progress.completed / progress.total) * 100)
      : null;

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View className="flex-1 items-center justify-center bg-black/40 px-8">
        <View className="bg-card w-full rounded-2xl p-5">
          <Text className="text-center text-base font-medium">{title}</Text>
          <Text variant="muted" className="mt-2 text-center text-sm leading-5">
            {progress?.message ?? 'Working…'}
          </Text>
          <ActivityIndicator className="mt-4" />
          {percent != null ? (
            <Text variant="muted" className="mt-2 text-center text-xs">
              {percent}%
            </Text>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}
