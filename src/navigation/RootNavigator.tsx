import {
  NavigationContainer,
  DefaultTheme,
  DarkTheme,
  useNavigationContainerRef,
} from '@react-navigation/native';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {useColorScheme} from 'react-native';
import {useCallback, useEffect, useMemo} from 'react';

import type {RootStackParamList} from '@/navigation/types';
import {CaptureActivityScreen} from '@/screens/capture/CaptureActivityScreen';
import {CaptureNoteScreen} from '@/screens/capture/CaptureNoteScreen';
import {CapturePhotoScreen} from '@/screens/capture/CapturePhotoScreen';
import {CaptureVoiceScreen} from '@/screens/capture/CaptureVoiceScreen';
import {MapScreen} from '@/screens/MapScreen';
import {HistoryDatePickerScreen} from '@/screens/map/HistoryDatePickerScreen';
import {MomentPreviewScreen} from '@/screens/moments/MomentPreviewScreen';
import {SavedPlacesScreen} from '@/screens/map/SavedPlacesScreen';
import {RestoreBackupScreen} from '@/screens/backup/RestoreBackupScreen';
import {RestoreBackupGate} from '@/components/backup/RestoreBackupGate';
import {SettingsScreen} from '@/screens/SettingsScreen';
import {useThemeColors} from '@/hooks/use-theme-colors';
import {setWidgetNavigationRef} from '@/lib/widget/widget-deep-link';

const Stack = createNativeStackNavigator<RootStackParamList>();

const sheetCaptureScreenOptions = {
  headerShown: false,
  presentation: 'transparentModal' as const,
  animation: 'none' as const,
  contentStyle: {backgroundColor: 'transparent'},
  gestureEnabled: false,
};

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
      theme={navigationTheme}>
      <Stack.Navigator>
        <Stack.Screen name="Map" component={MapScreen} options={{headerShown: false}} />
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
          component={CapturePhotoScreen}
          options={{
            headerShown: false,
            presentation: 'fullScreenModal',
            animation: 'slide_from_bottom',
          }}
        />
        <Stack.Screen
          name="CaptureVoice"
          component={CaptureVoiceScreen}
          options={sheetCaptureScreenOptions}
        />
        <Stack.Screen
          name="CaptureActivity"
          component={CaptureActivityScreen}
          options={sheetCaptureScreenOptions}
        />
        <Stack.Screen
          name="HistoryDatePicker"
          component={HistoryDatePickerScreen}
          options={sheetCaptureScreenOptions}
        />
        <Stack.Screen
          name="SavedPlaces"
          component={SavedPlacesScreen}
          options={sheetCaptureScreenOptions}
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
      <RestoreBackupGate />
    </NavigationContainer>
  );
}
