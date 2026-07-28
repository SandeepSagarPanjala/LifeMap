import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { X } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { loadCachedPlacesCount } from '@/components/settings/cached-places-settings';
import { AppVersionFooter } from '@/components/settings/app-version-footer';
import {
  SettingsGroup,
  SettingsGroupDivider,
  SettingsGroupLabel,
  SettingsLinkRow,
} from '@/components/settings/settings-group';
import { TrackingSettings } from '@/components/settings/tracking-settings';
import { MapGlassCircleButton } from '@/components/map/MapGlassCircleButton';
import { useThemeColors } from '@/hooks/use-theme-colors';
import { backupScheduleLabel } from '@/lib/backup/backup-settings';
import { getBackupStatus } from '@/lib/backup/backup-service';
import { driveMapRefreshIntervalLabel } from '@/lib/app-copy';
import {
  MAP_MOMENTS_BAR_GAP,
  MAP_MOMENTS_BAR_HEIGHT,
  MAP_STACK_BUTTON_SIZE,
} from '@/lib/app-constants';
import { getDriveMapRefreshIntervalMs } from '@/lib/drive-map-refresh-settings';
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
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const accentTheme = useAppStore(state => state.accentTheme);
  const distanceUnit = useAppStore(state => state.distanceUnit);
  const [storageSummary, setStorageSummary] = useState<string | undefined>();
  const [cachedPlacesSummary, setCachedPlacesSummary] = useState<
    string | undefined
  >();
  const [backupSummary, setBackupSummary] = useState<string | undefined>();
  const [driveMapRefreshSummary, setDriveMapRefreshSummary] = useState<
    string | undefined
  >();

  const handleClose = useCallback(() => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    }
  }, [navigation]);

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

  const bottomPad =
    MAP_MOMENTS_BAR_HEIGHT +
    Math.max(insets.bottom, MAP_MOMENTS_BAR_GAP) +
    16;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: Math.max(insets.top, 12),
            paddingBottom: bottomPad,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
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

        <SettingsGroupLabel title="Trips" />
        <SettingsGroup>
          <SettingsLinkRow
            label="Drive map updates"
            value={driveMapRefreshSummary}
            onPress={() => navigation.navigate('DriveMapRefreshSettings')}
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

        <SettingsGroupLabel title="Developer" />
        <SettingsGroup>
          <SettingsLinkRow
            label="Export & developer tools"
            onPress={() => navigation.navigate('DeveloperSettings')}
          />
        </SettingsGroup>

        <AppVersionFooter />
      </ScrollView>

      <View
        pointerEvents="box-none"
        style={[
          styles.barWrap,
          { paddingBottom: Math.max(insets.bottom, MAP_MOMENTS_BAR_GAP) },
        ]}
      >
        <MapGlassCircleButton
          accessibilityLabel="Close"
          onPress={handleClose}
          style={styles.closeButton}
        >
          <X size={20} color={colors.primary} strokeWidth={2.25} />
        </MapGlassCircleButton>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
  },
  barWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
  },
  closeButton: {
    width: MAP_STACK_BUTTON_SIZE,
    height: MAP_STACK_BUTTON_SIZE,
  },
});
