import {NavigationContainer, DefaultTheme, DarkTheme} from '@react-navigation/native';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {useColorScheme} from 'react-native';

import {MainTabNavigator} from '@/navigation/MainTabNavigator';
import type {RootStackParamList} from '@/navigation/types';
import {DayDetailScreen} from '@/screens/DayDetailScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

const LightNavTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: 'hsl(30 33% 98%)',
    card: 'hsl(0 0% 100%)',
    text: 'hsl(24 10% 10%)',
    border: 'hsl(30 12% 88%)',
    primary: 'hsl(16 65% 45%)',
  },
};

const DarkNavTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: 'hsl(24 10% 8%)',
    card: 'hsl(24 10% 11%)',
    text: 'hsl(30 20% 96%)',
    border: 'hsl(24 8% 20%)',
    primary: 'hsl(16 70% 55%)',
  },
};

export function RootNavigator() {
  const colorScheme = useColorScheme();

  return (
    <NavigationContainer theme={colorScheme === 'dark' ? DarkNavTheme : LightNavTheme}>
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
