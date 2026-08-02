import { useCallback, useState } from 'react';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { loadCachedPlacesCount } from '@/components/settings/cached-places-settings';
import { AppVersionFooter } from '@/components/settings/app-version-footer';
import { SettingsScreenLayout } from '@/components/settings/SettingsScreenLayout';
import {
  SettingsGroup,
  SettingsGroupDivider,
  SettingsGroupLabel,
  SettingsLinkRow,
} from '@/components/settings/settings-group';
import { TrackingSettings } from '@/components/settings/tracking-settings';
import { backupScheduleLabel } from '@/lib/backup/backup-settings';
import { getBackupStatus } from '@/lib/backup/backup-service';
import { formatStorageBytes } from '@/lib/format-storage';
import { loadCachedStorageBreakdown } from '@/lib/settings-stats';
import type { RootStackParamList } from '@/navigation/types';
import {
  DISTANCE_UNIT_LABELS,
  accentThemeLabel,
} from '@/navigation/settings-sub-screen-options';
import { useAppStore } from '@/stores/app-store';

export function SettingsScreen() {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const accentTheme = useAppStore(state => state.accentTheme);
  const distanceUnit = useAppStore(state => state.distanceUnit);
  const [storageSummary, setStorageSummary] = useState<string | undefined>();
  const [cachedPlacesSummary, setCachedPlacesSummary] = useState<
    string | undefined
  >();
  const [backupSummary, setBackupSummary] = useState<string | undefined>();

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
          const cachedPlacesCount = await loadCachedPlacesCount();
          if (!cancelled) {
            setCachedPlacesSummary(
              cachedPlacesCount === 1
                ? '1 place'
                : `${cachedPlacesCount.toLocaleString()} places`,
            );
          }
        } catch {
          if (!cancelled) {
            setCachedPlacesSummary(undefined);
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
      };

      void loadSummaries();

      return () => {
        cancelled = true;
      };
    }, []),
  );

  return (
    <SettingsScreenLayout>
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
      </SettingsGroup>

      <SettingsGroupLabel title="Tracking" />
      <TrackingSettings />

      <SettingsGroupLabel title="Notifications" />
      <SettingsGroup>
        <SettingsLinkRow
          label="Notifications"
          onPress={() => navigation.navigate('NotificationsSettings')}
        />
      </SettingsGroup>

      <SettingsGroupLabel title="Apple Health" />
      <SettingsGroup>
        <SettingsLinkRow
          label="Apple Health"
          onPress={() => navigation.navigate('HealthSettings')}
        />
      </SettingsGroup>

      <SettingsGroupLabel title="Information" />
      <SettingsGroup>
        <SettingsLinkRow
          label="Storage"
          value={storageSummary}
          onPress={() => navigation.navigate('StorageSettings')}
        />
        <SettingsGroupDivider />
        <SettingsLinkRow
          label="Cached places"
          value={cachedPlacesSummary}
          onPress={() => navigation.navigate('CachedPlacesSettings')}
        />
        <SettingsGroupDivider />
        <SettingsLinkRow
          label="Backup"
          value={backupSummary}
          onPress={() => navigation.navigate('BackupSettings')}
        />
      </SettingsGroup>

      {__DEV__ ? (
        <>
          <SettingsGroupLabel title="Developer" />
          <SettingsGroup>
            <SettingsLinkRow
              label="Export & developer tools"
              onPress={() => navigation.navigate('DeveloperSettings')}
            />
          </SettingsGroup>
        </>
      ) : null}

      <AppVersionFooter />
    </SettingsScreenLayout>
  );
}
