import {useCallback, useEffect, useState} from 'react';
import {format} from 'date-fns';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  View,
} from 'react-native';
import {CloudUpload, ChevronRight} from 'lucide-react-native';

import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';

import {Icon} from '@/components/ui/icon';
import {Text} from '@/components/ui/text';
import {BackupProgressModal} from '@/components/backup/BackupProgressModal';
import {useThemeColors} from '@/hooks/use-theme-colors';
import {
  areBackupPrefsInitialized,
  backupScheduleLabel,
  initializeBackupPreferencesOnLaunch,
  setBackupAutoSchedule,
  type BackupAutoSchedule,
} from '@/lib/backup/backup-settings';
import type {RootStackParamList} from '@/navigation/types';
import {shouldShowSettingsRestore} from '@/lib/backup/backup-install-state';
import {
  getBackupStatus,
  runBackupNow,
  shouldPromptBeforeCloudBackupReplace,
  type BackupStatus,
} from '@/lib/backup/backup-service';
import {
  exportBackupToDrive,
  pickAndStageDriveBackup,
} from '@/lib/backup/backup-drive';
import {
  getCloudBackupButtonLabel,
  getCloudRestoreButtonLabel,
} from '@/lib/backup/native-backup-cloud';
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

function formatCloudBackupLabel(exportedAt: string, totalBytes: number): string {
  const when = format(new Date(exportedAt), "MMM d, yyyy 'at' h:mm a");
  if (totalBytes > 0) {
    return `${when} (${formatStorageBytes(totalBytes)})`;
  }
  return when;
}

export function BackupSettings() {
  const colors = useThemeColors();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [status, setStatus] = useState<BackupStatus | null>(null);
  const [showSettingsRestore, setShowSettingsRestore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [backingUp, setBackingUp] = useState(false);
  const [exportingToDrive, setExportingToDrive] = useState(false);
  const [importingFromDrive, setImportingFromDrive] = useState(false);
  const [progress, setProgress] = useState<BackupProgress | null>(null);

  const refreshStatus = useCallback(async () => {
    setLoading(true);
    try {
      if (!(await areBackupPrefsInitialized())) {
        await initializeBackupPreferencesOnLaunch(false);
      }
      const [nextStatus, nextShowRestore] = await Promise.all([
        getBackupStatus(),
        shouldShowSettingsRestore(),
      ]);
      setStatus(nextStatus);
      setShowSettingsRestore(nextShowRestore);
    } catch {
      setStatus({
        cloudAvailable: false,
        cloudProviderLabel: 'iCloud',
        cloudBackup: null,
        lastBackupAt: null,
        lastBackupBytes: 0,
        autoSchedule: 'off',
      });
      setShowSettingsRestore(false);
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
    const replacePrompt = await shouldPromptBeforeCloudBackupReplace();
    if (replacePrompt == null) {
      await performBackupNow();
      return;
    }

    const {cloudBackup, localEstimateBytes} = replacePrompt;
    const provider = status?.cloudProviderLabel ?? 'iCloud';
    const backupLabel = formatCloudBackupLabel(
      cloudBackup.exportedAt,
      cloudBackup.totalBytes,
    );

    Alert.alert(
      `${provider} backup is larger`,
      `Your ${provider} backup (${formatStorageBytes(cloudBackup.totalBytes)}) from ${backupLabel} is larger than what this phone would save now (${formatStorageBytes(localEstimateBytes)}). Restore first, replace it anyway, or cancel.`,
      [
        {
          text: 'Restore',
          onPress: () =>
            navigation.navigate('RestoreBackup', {source: 'settings'}),
        },
        {
          text: 'Replace backup',
          style: 'destructive',
          onPress: () => {
            void performBackupNow();
          },
        },
        {text: 'Cancel', style: 'cancel'},
      ],
    );
  }, [navigation, performBackupNow, status?.cloudProviderLabel]);

  const handleExportToDrive = useCallback(async () => {
    setExportingToDrive(true);
    setProgress({phase: 'exporting', message: 'Starting export…'});
    try {
      const result = await exportBackupToDrive(next => {
        setProgress(next);
      });
      Alert.alert(
        'Backup ready',
        `Created a ${formatStorageBytes(result.totalBytes)} backup file. Save it to Google Drive from the share sheet.`,
      );
    } catch (error) {
      Alert.alert(
        'Export failed',
        error instanceof Error ? error.message : 'Something went wrong.',
      );
    } finally {
      setExportingToDrive(false);
      setProgress(null);
    }
  }, []);

  const handleImportFromDrive = useCallback(async () => {
    setImportingFromDrive(true);
    try {
      const staged = await pickAndStageDriveBackup(next => {
        setProgress(next);
      });
      if (!staged) {
        return;
      }
      navigation.navigate('RestoreBackup', {source: 'drive'});
    } catch (error) {
      Alert.alert(
        'Import failed',
        error instanceof Error ? error.message : 'Something went wrong.',
      );
    } finally {
      setImportingFromDrive(false);
      setProgress(null);
    }
  }, [navigation]);

  const chooseSchedule = () => {
    Alert.alert(
      'Auto backup',
      'Back up automatically on Wi-Fi. Off by default until you turn it on.',
      [
      ...SCHEDULE_OPTIONS.map(option => ({
        text: backupScheduleLabel(option),
        onPress: () => {
          void setBackupAutoSchedule(option).then(refreshStatus);
        },
      })),
      {text: 'Cancel', style: 'cancel'},
    ]);
  };

  const lastBackupAt = status?.lastBackupAt ?? null;
  const lastBackupBytes = status?.lastBackupBytes ?? 0;
  const busy = backingUp || exportingToDrive || importingFromDrive;
  const cloudBackupLabel = getCloudBackupButtonLabel();
  const cloudRestoreLabel = getCloudRestoreButtonLabel();

  return (
    <>
      <View className="bg-card border-border rounded-2xl border p-4">
        <View className="flex-row items-center gap-3">
          <Icon as={CloudUpload} size={20} color={colors.primary} />
          <View className="flex-1">
            <Text className="font-medium">Backup</Text>
            <Text variant="muted" className="mt-1 text-sm leading-5">
              {showSettingsRestore
                ? `An ${status?.cloudProviderLabel ?? 'iCloud'} backup is available to restore on this phone.`
                : `Keep one ${status?.cloudProviderLabel ?? 'iCloud'} backup of your map, visits, and memories.`}
            </Text>
          </View>
        </View>

        <View className="mt-4 items-center py-2">
          <Text className="text-center text-sm font-medium">
            Last backup on this phone: {formatBackupTimestamp(lastBackupAt)}
          </Text>
          <Text variant="muted" className="mt-1 text-center text-sm">
            Last backup size: {formatStorageBytes(lastBackupBytes)}
          </Text>
          {loading ? (
            <ActivityIndicator className="mt-3" />
          ) : null}
          {!status?.cloudAvailable && Platform.OS === 'ios' ? (
            <Text variant="muted" className="mt-3 text-center text-xs leading-4">
              iCloud is unavailable. Sign in to iCloud and allow LifeMap to use
              iCloud, then try again.
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
              {cloudBackupLabel}
            </Text>
          )}
        </Pressable>

        <Pressable
          accessibilityRole="button"
          disabled={busy || loading}
          onPress={() => void handleExportToDrive()}
          className={`border-border mt-3 rounded-xl border px-4 py-3 ${
            busy ? 'opacity-50' : ''
          }`}>
          {exportingToDrive ? (
            <ActivityIndicator />
          ) : (
            <Text className="text-primary text-center text-base font-medium">
              Export or Backup to Drive
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

        <Pressable
          accessibilityRole="button"
          disabled={busy || loading}
          onPress={() => void handleImportFromDrive()}
          className={`border-border mt-3 flex-row items-center justify-between rounded-xl border px-4 py-3 ${
            busy ? 'opacity-50' : ''
          }`}>
          <Text className="text-base">
            {importingFromDrive && progress == null ? 'Choose a file…' : 'Import'}
          </Text>
          {importingFromDrive && progress != null ? (
            <ActivityIndicator />
          ) : importingFromDrive ? null : (
            <Icon as={ChevronRight} size={18} color={colors.mutedForeground} />
          )}
        </Pressable>

        {showSettingsRestore ? (
          <Pressable
            accessibilityRole="button"
            disabled={busy || loading}
            onPress={() => navigation.navigate('RestoreBackup', {source: 'settings'})}
            className={`border-border mt-3 flex-row items-center justify-between rounded-xl border px-4 py-3 ${
              busy ? 'opacity-50' : ''
            }`}>
            <Text className="text-base">{cloudRestoreLabel}</Text>
            <Icon as={ChevronRight} size={18} color={colors.mutedForeground} />
          </Pressable>
        ) : null}

        <Text variant="muted" className="mt-3 text-xs leading-4">
          Connect to Wi-Fi for large backups. LifeMap keeps one{' '}
          {status?.cloudProviderLabel ?? 'iCloud'} backup. Use Drive export for a
          portable copy you can save to Google Drive. Auto backup stays off until
          you enable it. End-to-end encrypted backup is coming later.
        </Text>
      </View>

      <BackupProgressModal
        visible={progress != null}
        progress={progress}
        title={
          exportingToDrive
            ? 'Exporting backup'
            : importingFromDrive && progress != null
              ? 'Importing backup'
              : 'Backing up'
        }
      />
    </>
  );
}
