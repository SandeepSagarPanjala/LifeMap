import {useCallback, useState} from 'react';
import {View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useFocusEffect} from '@react-navigation/native';

import {
  SettingsCheckRow,
  SettingsGroup,
  SettingsGroupDivider,
} from '@/components/settings/settings-group';
import {Text} from '@/components/ui/text';
import {
  DRIVE_MAP_REFRESH_INTERVAL_OPTIONS,
  getDriveMapRefreshIntervalMs,
  notifyDriveMapRefreshIntervalChanged,
  setDriveMapRefreshIntervalMs,
  type DriveMapRefreshIntervalMs,
} from '@/lib/drive-map-refresh-settings';

export function DriveMapRefreshSettingsScreen() {
  const [intervalMs, setIntervalMs] = useState<DriveMapRefreshIntervalMs>(
    DRIVE_MAP_REFRESH_INTERVAL_OPTIONS[1]!.ms,
  );

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      void getDriveMapRefreshIntervalMs().then(ms => {
        if (!cancelled) {
          setIntervalMs(ms);
        }
      });
      return () => {
        cancelled = true;
      };
    }, []),
  );

  const handleSelect = async (ms: DriveMapRefreshIntervalMs) => {
    setIntervalMs(ms);
    await setDriveMapRefreshIntervalMs(ms);
    notifyDriveMapRefreshIntervalChanged(ms);
  };

  return (
    <SafeAreaView className="bg-background flex-1" edges={['bottom']}>
      <Text variant="muted" className="px-5 pt-4 text-sm leading-5">
        While you are driving with the app open, the map path refreshes on this
        schedule. At home or in the background, updates use an 8 second quiet
        debounce instead.
      </Text>
      <SettingsGroup className="mx-5 mt-3">
        {DRIVE_MAP_REFRESH_INTERVAL_OPTIONS.map((option, index) => (
          <View key={option.ms}>
            {index > 0 ? <SettingsGroupDivider /> : null}
            <SettingsCheckRow
              label={option.label}
              selected={intervalMs === option.ms}
              onPress={() => void handleSelect(option.ms)}
            />
          </View>
        ))}
      </SettingsGroup>
    </SafeAreaView>
  );
}
