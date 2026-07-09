import {
  NavigationContainer,
  DefaultTheme,
  DarkTheme,
  useNavigationContainerRef,
} from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useColorScheme } from 'react-native';
import { useCallback, useEffect, useMemo } from 'react';

import type { RootStackParamList } from '@/navigation/types';
import { withFeatureErrorBoundary } from '@/components/error-boundary';
import { BenchmarkScreen } from '@/screens/benchmark/BenchmarkScreen';
import { CaptureActivityScreen } from '@/screens/capture/CaptureActivityScreen';
import { CaptureNoteScreen } from '@/screens/capture/CaptureNoteScreen';
import { CapturePhotoScreen } from '@/screens/capture/CapturePhotoScreen';
import { CaptureVoiceScreen } from '@/screens/capture/CaptureVoiceScreen';
import { MapScreen } from '@/screens/MapScreen';
import { HistoryDatePickerScreen } from '@/screens/map/HistoryDatePickerScreen';
import { MomentPreviewScreen } from '@/screens/moments/MomentPreviewScreen';
import { SavedPlacesScreen } from '@/screens/map/SavedPlacesScreen';
import { RestoreBackupScreen } from '@/screens/backup/RestoreBackupScreen';
import { ScheduledBackupRunner } from '@/components/backup/ScheduledBackupRunner';
import { PlaceLookupCatchUpRunner } from '@/components/place-lookup/PlaceLookupCatchUpRunner';
import { SettingsScreen } from '@/screens/SettingsScreen';
import { DeveloperSettingsScreen } from '@/screens/settings/DeveloperSettingsScreen';
import { ExportTripDaysScreen } from '@/screens/settings/export/ExportTripDaysScreen';
import { ExportTripDetailScreen } from '@/screens/settings/export/ExportTripDetailScreen';
import { BackupSettingsScreen } from '@/screens/settings/BackupSettingsScreen';
import { DistanceUnitSettingsScreen } from '@/screens/settings/DistanceUnitSettingsScreen';
import { DriveMapRefreshSettingsScreen } from '@/screens/settings/DriveMapRefreshSettingsScreen';
import { PreferredMapsSettingsScreen } from '@/screens/settings/PreferredMapsSettingsScreen';
import { CachedPlacesSettingsScreen } from '@/screens/settings/CachedPlacesSettingsScreen';
import { CachedPlaceMapScreen } from '@/screens/settings/CachedPlaceMapScreen';
import { StorageSettingsScreen } from '@/screens/settings/StorageSettingsScreen';
import { ThemeSettingsScreen } from '@/screens/settings/ThemeSettingsScreen';
import { useThemeColors } from '@/hooks/use-theme-colors';
import { setWidgetNavigationRef } from '@/lib/widget/widget-deep-link';
import { activityCaptureScreenOptions } from '@/navigation/activity-capture-screen-options';
import { nativeHalfSheetCaptureScreenOptions } from '@/navigation/native-half-sheet-capture-options';
import { settingsSubScreenOptions } from '@/navigation/settings-sub-screen-options';
import { voiceCaptureScreenOptions } from '@/navigation/voice-capture-screen-options';

const Stack = createNativeStackNavigator<RootStackParamList>();

const MapScreenWithBoundary = withFeatureErrorBoundary(MapScreen, 'map');
const CapturePhotoScreenWithBoundary = withFeatureErrorBoundary(
  CapturePhotoScreen,
  'capture',
  { dismissible: true },
);

export function RootNavigator() {
  const navigationRef = useNavigationContainerRef<RootStackParamList>();
  const colorScheme = useColorScheme();
  const colors = useThemeColors();

  const handleNavigationReady = useCallback(() => {
    setWidgetNavigationRef(navigationRef);
  }, [navigationRef]);

  useEffect(() => {
    return () => setWidgetNavigationRef(null);
  }, []);

  const navigationTheme = useMemo(
    () => ({
      ...(colorScheme === 'dark' ? DarkTheme : DefaultTheme),
      colors: {
        ...(colorScheme === 'dark' ? DarkTheme.colors : DefaultTheme.colors),
        background: colors.background,
        card: colors.card,
        text: colors.foreground,
        border: colors.border,
        primary: colors.primary,
      },
    }),
    [colorScheme, colors],
  );

  return (
    <NavigationContainer
      ref={navigationRef}
      onReady={handleNavigationReady}
      theme={navigationTheme}
    >
      <Stack.Navigator>
        <Stack.Screen
          name="Map"
          component={MapScreenWithBoundary}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="RestoreBackup"
          component={RestoreBackupScreen}
          options={{
            headerShown: false,
            presentation: 'card',
            gestureEnabled: false,
          }}
        />
        <Stack.Screen
          name="Settings"
          component={SettingsScreen}
          options={{
            title: 'Settings',
            headerBackTitle: 'Map',
            presentation: 'card',
          }}
        />
        <Stack.Screen
          name="ThemeSettings"
          component={ThemeSettingsScreen}
          options={settingsSubScreenOptions('Theme')}
        />
        <Stack.Screen
          name="DistanceUnitSettings"
          component={DistanceUnitSettingsScreen}
          options={settingsSubScreenOptions('Distance unit')}
        />
        <Stack.Screen
          name="PreferredMapsSettings"
          component={PreferredMapsSettingsScreen}
          options={settingsSubScreenOptions('Preferred maps app')}
        />
        <Stack.Screen
          name="DriveMapRefreshSettings"
          component={DriveMapRefreshSettingsScreen}
          options={settingsSubScreenOptions('Drive map updates')}
        />
        <Stack.Screen
          name="StorageSettings"
          component={StorageSettingsScreen}
          options={settingsSubScreenOptions('Storage')}
        />
        <Stack.Screen
          name="CachedPlacesSettings"
          component={CachedPlacesSettingsScreen}
          options={settingsSubScreenOptions('Cached places')}
        />
        <Stack.Screen
          name="CachedPlaceMap"
          component={CachedPlaceMapScreen}
          options={settingsSubScreenOptions('Cached place map')}
        />
        <Stack.Screen
          name="BackupSettings"
          component={BackupSettingsScreen}
          options={settingsSubScreenOptions('Backup')}
        />
        <Stack.Screen
          name="DeveloperSettings"
          component={DeveloperSettingsScreen}
          options={settingsSubScreenOptions('Developer tools')}
        />
        <Stack.Screen
          name="ExportTripDays"
          component={ExportTripDaysScreen}
          options={settingsSubScreenOptions('Trip days')}
        />
        <Stack.Screen
          name="ExportTripDetail"
          component={ExportTripDetailScreen}
          options={settingsSubScreenOptions('Trip detail')}
        />
        <Stack.Screen
          name="CaptureNote"
          component={CaptureNoteScreen}
          options={{
            headerShown: false,
            presentation: 'fullScreenModal',
            animation: 'slide_from_bottom',
          }}
        />
        <Stack.Screen
          name="CapturePhoto"
          component={CapturePhotoScreenWithBoundary}
          options={{
            headerShown: false,
            presentation: 'fullScreenModal',
            animation: 'slide_from_bottom',
          }}
        />
        <Stack.Screen
          name="CaptureVoice"
          component={CaptureVoiceScreen}
          options={voiceCaptureScreenOptions}
        />
        <Stack.Screen
          name="CaptureActivity"
          component={CaptureActivityScreen}
          options={activityCaptureScreenOptions}
        />
        <Stack.Screen
          name="HistoryDatePicker"
          component={HistoryDatePickerScreen}
          options={nativeHalfSheetCaptureScreenOptions}
        />
        <Stack.Screen
          name="SavedPlaces"
          component={SavedPlacesScreen}
          options={nativeHalfSheetCaptureScreenOptions}
        />
        <Stack.Screen
          name="Benchmark"
          component={BenchmarkScreen}
          options={{
            title: 'Benchmark',
            headerBackTitle: 'Settings',
            presentation: 'card',
          }}
        />
        <Stack.Screen
          name="MomentPreview"
          component={MomentPreviewScreen}
          options={{
            headerShown: false,
            presentation: 'fullScreenModal',
            animation: 'none',
          }}
        />
      </Stack.Navigator>
      <ScheduledBackupRunner />
      <PlaceLookupCatchUpRunner />
    </NavigationContainer>
  );
}
