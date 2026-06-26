import {useCallback, useEffect, useState} from 'react';
import {format} from 'date-fns';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  View,
} from 'react-native';
import {CloudUpload, ChevronRight} from 'lucide-react-native';

import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';

import {Icon} from '@/components/ui/icon';
import {Text} from '@/components/ui/text';
import {useThemeColors} from '@/hooks/use-theme-colors';
import {
  backupScheduleLabel,
  setBackupAutoSchedule,
  type BackupAutoSchedule,
} from '@/lib/backup/backup-settings';
import type {RootStackParamList} from '@/navigation/types';
import {shouldShowSettingsRestore} from '@/lib/backup/backup-install-state';
import {
  getBackupStatus,
  getBackupSizeWarning,
  runBackupNow,
  type BackupStatus,
} from '@/lib/backup/backup-service';
import type {BackupProgress} from '@/lib/backup/backup-types';
import {formatStorageBytes} from '@/lib/format-storage';

const SCHEDULE_OPTIONS: BackupAutoSchedule[] = ['off', 'daily', 'weekly'];

function formatBackupTimestamp(value: Date | string | null): string {
  if (!value) {
    return 'Never';
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'Never';
  }
  return format(date, "MMM d, yyyy 'at' h:mm a");
}

export function BackupSettings() {
  const colors = useThemeColors();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [status, setStatus] = useState<BackupStatus | null>(null);
  const [showSettingsRestore, setShowSettingsRestore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [backingUp, setBackingUp] = useState(false);
  const [progress, setProgress] = useState<BackupProgress | null>(null);

  const refreshStatus = useCallback(async () => {
    setLoading(true);
    try {
      const [nextStatus, nextShowRestore] = await Promise.all([
        getBackupStatus(),
        shouldShowSettingsRestore(),
      ]);
      setStatus(nextStatus);
      setShowSettingsRestore(nextShowRestore);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshStatus();
  }, [refreshStatus]);

  const performBackupNow = useCallback(async () => {
    setBackingUp(true);
    setProgress({phase: 'exporting', message: 'Starting backup…'});
    try {
      const result = await runBackupNow(setProgress);
      await refreshStatus();
      Alert.alert(
        'Backup complete',
        `Saved ${formatStorageBytes(result.totalBytes)} to ${status?.cloudProviderLabel ?? 'cloud'}.`,
      );
    } catch (error) {
      Alert.alert(
        'Backup failed',
        error instanceof Error ? error.message : 'Something went wrong.',
      );
    } finally {
      setBackingUp(false);
      setProgress(null);
    }
  }, [refreshStatus, status?.cloudProviderLabel]);

  const handleBackupNow = useCallback(async () => {
    const warning = await getBackupSizeWarning();
    if (warning == null) {
      await performBackupNow();
      return;
    }

    const provider = status?.cloudProviderLabel ?? 'cloud';
    Alert.alert(
      'Larger backup already saved',
      `Your ${provider} backup (${formatStorageBytes(warning.cloudBytes)}) is larger than your current data (${formatStorageBytes(warning.localEstimateBytes)}). Restoring may recover more memories.`,
      [
        {
          text: 'Restore first',
          onPress: () => navigation.navigate('RestoreBackup', {source: 'settings'}),
        },
        {
          text: 'Back up anyway',
          onPress: () => {
            void performBackupNow();
          },
        },
        {text: 'Ignore', style: 'cancel'},
      ],
    );
  }, [navigation, performBackupNow, status?.cloudProviderLabel]);

  const chooseSchedule = () => {
    Alert.alert('Auto backup', 'Choose how often LifeMap backs up on Wi-Fi.', [
      ...SCHEDULE_OPTIONS.map(option => ({
        text: backupScheduleLabel(option),
        onPress: () => {
          void setBackupAutoSchedule(option).then(refreshStatus);
        },
      })),
      {text: 'Cancel', style: 'cancel'},
    ]);
  };

  const lastBackupAt =
    status?.lastBackupAt ??
    (status?.cloudBackup?.exportedAt
      ? new Date(status.cloudBackup.exportedAt)
      : null);
  const lastBackupBytes =
    status?.lastBackupBytes ?? status?.cloudBackup?.totalBytes ?? 0;
  const busy = backingUp;

  return (
    <>
      <View className="bg-card border-border rounded-2xl border p-4">
        <View className="flex-row items-center gap-3">
          <Icon as={CloudUpload} size={20} color={colors.primary} />
          <View className="flex-1">
            <Text className="font-medium">Backup</Text>
            <Text variant="muted" className="mt-1 text-sm leading-5">
              {showSettingsRestore
                ? `Back up to ${status?.cloudProviderLabel ?? 'cloud'}. This install found an older iCloud backup you can still merge.`
                : `Back up your map, visits, and memories to ${status?.cloudProviderLabel ?? 'cloud'}.`}
            </Text>
          </View>
        </View>

        <View className="mt-4 items-center py-2">
          <Text className="text-center text-sm font-medium">
            Last backup: {formatBackupTimestamp(lastBackupAt)}
          </Text>
          <Text variant="muted" className="mt-1 text-center text-sm">
            Total size: {formatStorageBytes(lastBackupBytes)}
          </Text>
          {loading ? (
            <ActivityIndicator className="mt-3" />
          ) : null}
          {!status?.cloudAvailable && Platform.OS === 'ios' ? (
            <Text variant="muted" className="mt-3 text-center text-xs leading-4">
              Sign in to iCloud on this device to use backup.
            </Text>
          ) : null}
        </View>

        <Pressable
          accessibilityRole="button"
          disabled={busy || loading}
          onPress={() => void handleBackupNow()}
          className={`border-border mt-4 rounded-xl border px-4 py-3 ${
            busy ? 'opacity-50' : ''
          }`}>
          {backingUp ? (
            <ActivityIndicator />
          ) : (
            <Text className="text-primary text-center text-base font-medium">
              Back up now
            </Text>
          )}
        </Pressable>

        <Pressable
          accessibilityRole="button"
          disabled={busy || loading}
          onPress={chooseSchedule}
          className={`border-border mt-3 flex-row items-center justify-between rounded-xl border px-4 py-3 ${
            busy ? 'opacity-50' : ''
          }`}>
          <Text className="text-base">Auto backup</Text>
          <View className="flex-row items-center gap-2">
            <Text variant="muted" className="text-base">
              {backupScheduleLabel(status?.autoSchedule ?? 'off')}
            </Text>
            <Icon as={ChevronRight} size={18} color={colors.mutedForeground} />
          </View>
        </Pressable>

        {showSettingsRestore ? (
          <Pressable
            accessibilityRole="button"
            disabled={busy || loading}
            onPress={() => navigation.navigate('RestoreBackup', {source: 'settings'})}
            className={`border-border mt-3 flex-row items-center justify-between rounded-xl border px-4 py-3 ${
              busy ? 'opacity-50' : ''
            }`}>
            <Text className="text-base">Restore from iCloud</Text>
            <Icon as={ChevronRight} size={18} color={colors.mutedForeground} />
          </Pressable>
        ) : null}

        <Text variant="muted" className="mt-3 text-xs leading-4">
          Connect to Wi-Fi for large backups. LifeMap keeps your latest and
          previous cloud backup. End-to-end encrypted backup is coming later.
        </Text>
      </View>

      <BackupProgressModal visible={progress != null} progress={progress} />
    </>
  );
}

function BackupProgressModal({
  visible,
  progress,
}: {
  visible: boolean;
  progress: BackupProgress | null;
}) {
  const percent =
    progress?.total != null && progress.total > 0 && progress.completed != null
      ? Math.round((progress.completed / progress.total) * 100)
      : null;

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View className="flex-1 items-center justify-center bg-black/40 px-8">
        <View className="bg-card w-full rounded-2xl p-5">
          <Text className="text-center text-base font-medium">Backing up</Text>
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
