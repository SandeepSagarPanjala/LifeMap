import {createBottomTabNavigator, type BottomTabBarProps} from '@react-navigation/bottom-tabs';

import {CustomTabBar} from '@/components/navigation/CustomTabBar';
import type {RootTabParamList} from '@/navigation/types';
import {HomeScreen} from '@/screens/HomeScreen';
import {MapScreen} from '@/screens/MapScreen';
import {SettingsScreen} from '@/screens/SettingsScreen';
import {TimelineScreen} from '@/screens/TimelineScreen';

const Tab = createBottomTabNavigator<RootTabParamList>();

function renderTabBar(props: BottomTabBarProps) {
  return <CustomTabBar {...props} />;
}

export function MainTabNavigator() {
  return (
    <Tab.Navigator tabBar={renderTabBar} screenOptions={{headerShown: false}}>
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Map" component={MapScreen} />
      <Tab.Screen name="Timeline" component={TimelineScreen} />
      <Tab.Screen name="Settings" component={SettingsScreen} />
    </Tab.Navigator>
  );
}
