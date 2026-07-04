import {useCallback, useState} from 'react';
import {ScrollView} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useFocusEffect, useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';

import {AppVersionFooter} from '@/components/settings/app-version-footer';
import {
  SettingsGroup,
  SettingsGroupDivider,
  SettingsGroupLabel,
  SettingsLinkRow,
} from '@/components/settings/settings-group';
import {TrackingSettings} from '@/components/settings/tracking-settings';
import {TripRebuildSettings} from '@/components/settings/trip-rebuild-settings';
import {backupScheduleLabel} from '@/lib/backup/backup-settings';
import {getBackupStatus} from '@/lib/backup/backup-service';
import {driveMapRefreshIntervalLabel} from '@/lib/app-copy';
import {
  getDriveMapRefreshIntervalMs,
} from '@/lib/drive-map-refresh-settings';
import {formatStorageBytes} from '@/lib/format-storage';
import {loadCachedStorageBreakdown} from '@/lib/settings-stats';
import type {RootStackParamList} from '@/navigation/types';
import {
  DISTANCE_UNIT_LABELS,
  PREFERRED_MAP_APP_LABELS,
  accentThemeLabel,
} from '@/navigation/settings-sub-screen-options';
import {useAppStore} from '@/stores/app-store';

export function SettingsScreen() {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const accentTheme = useAppStore(state => state.accentTheme);
  const distanceUnit = useAppStore(state => state.distanceUnit);
  const preferredMapApp = useAppStore(state => state.preferredMapApp);
  const [storageSummary, setStorageSummary] = useState<string | undefined>();
  const [backupSummary, setBackupSummary] = useState<string | undefined>();
  const [driveMapRefreshSummary, setDriveMapRefreshSummary] = useState<
    string | undefined
  >();

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;

      const loadSummaries = async () => {
        try {
          const cached = await loadCachedStorageBreakdown();
          if (cancelled) {
            return;
          }
          const total = cached?.payload.items.find(
            item => item.category === 'total',
          );
          setStorageSummary(
            total != null ? formatStorageBytes(total.bytes) : undefined,
          );
        } catch {
          if (!cancelled) {
            setStorageSummary(undefined);
          }
        }

        try {
          const status = await getBackupStatus();
          if (cancelled) {
            return;
          }
          setBackupSummary(backupScheduleLabel(status.autoSchedule));
        } catch {
          if (!cancelled) {
            setBackupSummary(undefined);
          }
        }

        try {
          const intervalMs = await getDriveMapRefreshIntervalMs();
          if (!cancelled) {
            setDriveMapRefreshSummary(driveMapRefreshIntervalLabel(intervalMs));
          }
        } catch {
          if (!cancelled) {
            setDriveMapRefreshSummary(undefined);
          }
        }
      };

      void loadSummaries();

      return () => {
        cancelled = true;
      };
    }, []),
  );

  return (
    <SafeAreaView className="bg-background flex-1" edges={['bottom']}>
      <ScrollView
        className="flex-1"
        contentContainerClassName="px-5 pb-8 pt-2"
        showsVerticalScrollIndicator={false}>
        <SettingsGroupLabel isFirst title="Appearance" />
        <SettingsGroup>
          <SettingsLinkRow
            label="Theme"
            value={accentThemeLabel(accentTheme)}
            onPress={() => navigation.navigate('ThemeSettings')}
          />
        </SettingsGroup>

        <SettingsGroupLabel title="Maps & units" />
        <SettingsGroup>
          <SettingsLinkRow
            label="Distance unit"
            value={DISTANCE_UNIT_LABELS[distanceUnit]}
            onPress={() => navigation.navigate('DistanceUnitSettings')}
          />
          <SettingsGroupDivider />
          <SettingsLinkRow
            label="Preferred maps app"
            value={PREFERRED_MAP_APP_LABELS[preferredMapApp]}
            onPress={() => navigation.navigate('PreferredMapsSettings')}
          />
        </SettingsGroup>

        <SettingsGroupLabel title="Tracking" />
        <TrackingSettings />

        <SettingsGroupLabel title="Trips" />
        <SettingsGroup>
          <SettingsLinkRow
            label="Drive map updates"
            value={driveMapRefreshSummary}
            onPress={() => navigation.navigate('DriveMapRefreshSettings')}
          />
        </SettingsGroup>
        <TripRebuildSettings />

        <SettingsGroupLabel title="Information" />
        <SettingsGroup>
          <SettingsLinkRow
            label="Storage"
            value={storageSummary}
            onPress={() => navigation.navigate('StorageSettings')}
          />
          <SettingsGroupDivider />
          <SettingsLinkRow
            label="Backup"
            value={backupSummary}
            onPress={() => navigation.navigate('BackupSettings')}
          />
        </SettingsGroup>

        <SettingsGroupLabel title="Developer" />
        <SettingsGroup>
          <SettingsLinkRow
            label="Export & developer tools"
            onPress={() => navigation.navigate('DeveloperSettings')}
          />
        </SettingsGroup>

        <AppVersionFooter />
      </ScrollView>
    </SafeAreaView>
  );
}
