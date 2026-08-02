import {
  NavigationContainer,
  DefaultTheme,
  DarkTheme,
  useNavigationContainerRef,
} from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useColorScheme } from 'react-native';
import { useCallback, useEffect, useMemo, type ComponentType } from 'react';

import type { RootStackParamList } from '@/navigation/types';
import { withFeatureErrorBoundary } from '@/components/error-boundary';
import { BenchmarkScreen } from '@/screens/benchmark/BenchmarkScreen';
import { CaptureActivityScreen } from '@/screens/capture/CaptureActivityScreen';
import { ActivityFormScreen } from '@/screens/capture/ActivityFormScreen';
import { ActivityLogEntryScreen } from '@/screens/capture/ActivityLogEntryScreen';
import { ActivityManageScreen } from '@/screens/capture/ActivityManageScreen';
import { ActivityInsightsScreen } from '@/screens/capture/ActivityInsightsScreen';
import { ActivityInsightDetailScreen } from '@/screens/capture/ActivityInsightDetailScreen';
import { CaptureNoteScreen } from '@/screens/capture/CaptureNoteScreen';
import { CaptureMoodScreen } from '@/screens/capture/CaptureMoodScreen';
import { CapturePhotoScreen } from '@/screens/capture/CapturePhotoScreen';
import { DiaryInsightsScreen } from '@/screens/capture/DiaryInsightsScreen';
import { DiaryScreen } from '@/screens/capture/DiaryScreen';
import { MoodInsightsScreen } from '@/screens/capture/MoodInsightsScreen';
import { CaptureVoiceScreen } from '@/screens/capture/CaptureVoiceScreen';
import { MapScreen } from '@/screens/MapScreen';
import { HistoryDatePickerScreen } from '@/screens/map/HistoryDatePickerScreen';
import { MomentPreviewScreen } from '@/screens/moments/MomentPreviewScreen';
import { SavedPlacesScreen } from '@/screens/map/SavedPlacesScreen';
import { RestoreBackupScreen } from '@/screens/backup/RestoreBackupScreen';
import { ScheduledBackupRunner } from '@/components/backup/ScheduledBackupRunner';
import { SettingsScreen } from '@/screens/SettingsScreen';
import { DeveloperSettingsScreen } from '@/screens/settings/DeveloperSettingsScreen';
import { ExportTripDaysScreen } from '@/screens/settings/export/ExportTripDaysScreen';
import { ExportTripDetailScreen } from '@/screens/settings/export/ExportTripDetailScreen';
import { BackupSettingsScreen } from '@/screens/settings/BackupSettingsScreen';
import { DistanceUnitSettingsScreen } from '@/screens/settings/DistanceUnitSettingsScreen';
import { CachedPlacesSettingsScreen } from '@/screens/settings/CachedPlacesSettingsScreen';
import { CachedPlaceMapScreen } from '@/screens/settings/CachedPlaceMapScreen';
import { StorageSettingsScreen } from '@/screens/settings/StorageSettingsScreen';
import { ThemeSettingsScreen } from '@/screens/settings/ThemeSettingsScreen';
import { NotificationsSettingsScreen } from '@/screens/settings/NotificationsSettingsScreen';
import { HealthSettingsScreen } from '@/screens/settings/HealthSettingsScreen';
import { SleepDetailScreen } from '@/screens/health/SleepDetailScreen';
import { StepsDetailScreen } from '@/screens/health/StepsDetailScreen';
import { useThemeColors } from '@/hooks/use-theme-colors';
import { setWidgetNavigationRef } from '@/lib/widget/widget-deep-link';
import { setNotificationNavigationRef } from '@/lib/notifications/bootstrap';
import { activityCaptureScreenOptions } from '@/navigation/activity-capture-screen-options';
import { nativeHalfSheetCaptureScreenOptions } from '@/navigation/native-half-sheet-capture-options';
import { settingsSubScreenOptions } from '@/navigation/settings-sub-screen-options';
import { voiceCaptureScreenOptions } from '@/navigation/voice-capture-screen-options';

const Stack = createNativeStackNavigator<RootStackParamList>();

/** Lazy — avoid pulling Phosphor/You at RootNavigator first paint (inlineRequires). */
function getYouScreen(): ComponentType {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('@/screens/you/YouScreen').YouScreen;
}

function getGalleryDayJourneyScreen(): ComponentType {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('@/screens/gallery/GalleryDayJourneyScreen')
    .GalleryDayJourneyScreen;
}

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
    setNotificationNavigationRef(navigationRef);
  }, [navigationRef]);

  useEffect(() => {
    return () => {
      setWidgetNavigationRef(null);
      setNotificationNavigationRef(null);
    };
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
            headerShown: false,
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
          name="NotificationsSettings"
          component={NotificationsSettingsScreen}
          options={settingsSubScreenOptions('Notifications')}
        />
        <Stack.Screen
          name="HealthSettings"
          component={HealthSettingsScreen}
          options={settingsSubScreenOptions('Apple Health')}
        />
        <Stack.Screen
          name="SleepDetail"
          component={SleepDetailScreen}
          options={{
            headerShown: false,
            presentation: 'card',
            animation: 'slide_from_right',
          }}
        />
        <Stack.Screen
          name="StepsDetail"
          component={StepsDetailScreen}
          options={{
            headerShown: false,
            presentation: 'card',
            animation: 'slide_from_right',
          }}
        />
        {__DEV__ ? (
          <>
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
          </>
        ) : null}
        <Stack.Screen
          name="Diary"
          component={DiaryScreen}
          options={{
            headerShown: false,
            presentation: 'card',
          }}
        />
        <Stack.Screen
          name="DiaryInsights"
          component={DiaryInsightsScreen}
          options={{
            headerShown: false,
            presentation: 'card',
            animation: 'slide_from_right',
          }}
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
          name="CaptureMood"
          component={CaptureMoodScreen}
          options={{
            headerShown: false,
            presentation: 'card',
          }}
        />
        <Stack.Screen
          name="MoodInsights"
          component={MoodInsightsScreen}
          options={{
            headerShown: false,
            presentation: 'card',
            animation: 'slide_from_right',
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
          name="ActivityManage"
          component={ActivityManageScreen}
          options={{
            headerShown: false,
            presentation: 'card',
          }}
        />
        <Stack.Screen
          name="ActivityInsights"
          component={ActivityInsightsScreen}
          options={{
            headerShown: false,
            presentation: 'card',
            animation: 'slide_from_right',
          }}
        />
        <Stack.Screen
          name="ActivityInsightDetail"
          component={ActivityInsightDetailScreen}
          options={{
            headerShown: false,
            presentation: 'card',
            animation: 'slide_from_right',
          }}
        />
        <Stack.Screen
          name="ActivityForm"
          component={ActivityFormScreen}
          options={{
            headerShown: false,
            presentation: 'card',
          }}
        />
        <Stack.Screen
          name="ActivityLogEntry"
          component={ActivityLogEntryScreen}
          options={{
            headerShown: false,
            presentation: 'card',
          }}
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
        <Stack.Screen
          name="GalleryDayJourney"
          getComponent={getGalleryDayJourneyScreen}
          options={{
            headerShown: false,
            presentation: 'modal',
            animation: 'slide_from_bottom',
          }}
        />
        <Stack.Screen
          name="You"
          getComponent={getYouScreen}
          options={{
            headerShown: false,
            presentation: 'card',
          }}
        />
      </Stack.Navigator>
      <ScheduledBackupRunner />
    </NavigationContainer>
  );
}
