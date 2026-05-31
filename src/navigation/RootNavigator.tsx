import {NavigationContainer, DefaultTheme, DarkTheme} from '@react-navigation/native';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {useColorScheme} from 'react-native';
import {useMemo} from 'react';

import {MainTabNavigator} from '@/navigation/MainTabNavigator';
import type {RootStackParamList} from '@/navigation/types';
import {DayDetailScreen} from '@/screens/DayDetailScreen';
import {useThemeColors} from '@/hooks/use-theme-colors';

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  const colorScheme = useColorScheme();
  const colors = useThemeColors();

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
    [colorScheme, colors]
  );

  return (
    <NavigationContainer theme={navigationTheme}>
      <Stack.Navigator>
        <Stack.Screen
          name="MainTabs"
          component={MainTabNavigator}
          options={{headerShown: false}}
        />
        <Stack.Screen
          name="DayDetail"
          component={DayDetailScreen}
          options={{
            title: 'Day',
            headerBackTitle: 'Back',
          }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
