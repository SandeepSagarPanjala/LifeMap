import { Construction } from 'lucide-react-native';
import {
  Image,
  MapTrifold,
  Trophy,
  UserCircle,
  type Icon as PhosphorIcon,
} from 'phosphor-react-native';
import {
  useCallback,
  useMemo,
  type ComponentProps,
  type ComponentType,
  type ReactElement,
} from 'react';
import { View } from 'react-native';
import {
  createBottomTabNavigator,
  type BottomTabScreenProps,
} from '@react-navigation/bottom-tabs';

import { LiquidGlassTabBar } from '@/components/you/LiquidGlassTabBar';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useThemeColors } from '@/hooks/use-theme-colors';
import { ProfileScreen } from '@/screens/you/ProfileScreen';

export type YouTabParamList = {
  Profile: undefined;
  Gallery: undefined;
  Insights: undefined;
  Achievements: undefined;
};

type YouTabName = keyof YouTabParamList;

type TabBarIconProps = {
  color: string;
  size: number;
  focused: boolean;
};

/** Phosphor: regular when idle, duotone when active. */
function TabIcon({
  as: IconComponent,
  color,
  size,
  focused,
}: TabBarIconProps & { as: PhosphorIcon }) {
  return (
    <IconComponent
      size={size}
      color={color}
      weight={focused ? 'duotone' : 'regular'}
    />
  );
}

function ProfileTabIcon(props: TabBarIconProps) {
  return <TabIcon as={UserCircle} {...props} />;
}

function GalleryTabIcon(props: TabBarIconProps) {
  return <TabIcon as={Image} {...props} />;
}

function InsightsTabIcon(props: TabBarIconProps) {
  return <TabIcon as={MapTrifold} {...props} />;
}

function AchievementsTabIcon(props: TabBarIconProps) {
  return <TabIcon as={Trophy} {...props} />;
}

function UnderDevelopmentPanel({ title }: { title: string }) {
  const colors = useThemeColors();

  return (
    <View className="bg-background flex-1 items-center justify-center px-8">
      <View className="bg-muted/70 mb-5 h-16 w-16 items-center justify-center rounded-3xl">
        <Icon as={Construction} size={28} color={colors.mutedForeground} />
      </View>
      <Text variant="h3" className="text-center">
        {title}
      </Text>
      <Text variant="muted" className="mt-2 text-center">
        Under development
      </Text>
    </View>
  );
}

function YouTabPlaceholder({
  route,
}: BottomTabScreenProps<YouTabParamList>) {
  return <UnderDevelopmentPanel title={route.name} />;
}

const TABS: {
  name: YouTabName;
  label: string;
  tabBarIcon: (props: TabBarIconProps) => ReactElement;
  // Tab.Screen accepts route props; keep loose so placeholders + Profile share one list.
  component: ComponentType<any>;
}[] = [
  {
    name: 'Profile',
    label: 'Profile',
    tabBarIcon: ProfileTabIcon,
    component: ProfileScreen,
  },
  {
    name: 'Gallery',
    label: 'Gallery',
    tabBarIcon: GalleryTabIcon,
    component: YouTabPlaceholder,
  },
  {
    name: 'Insights',
    label: 'Insights',
    tabBarIcon: InsightsTabIcon,
    component: YouTabPlaceholder,
  },
  {
    name: 'Achievements',
    label: 'Achievements',
    tabBarIcon: AchievementsTabIcon,
    component: YouTabPlaceholder,
  },
];

const Tab = createBottomTabNavigator<YouTabParamList>();

const YOU_TAB_NAMES = new Set<string>(TABS.map(tab => tab.name));

/** Survives You screen unmount so reopen restores the last tab. */
let lastYouTab: YouTabName = 'Profile';

function readLastYouTab(): YouTabName {
  return YOU_TAB_NAMES.has(lastYouTab) ? lastYouTab : 'Profile';
}

export function YouScreen() {
  const screenOptions = useMemo(
    () => ({
      headerShown: false,
    }),
    [],
  );

  const renderTabBar = useCallback(
    (props: ComponentProps<typeof LiquidGlassTabBar>) => (
      <LiquidGlassTabBar {...props} />
    ),
    [],
  );

  const onTabStateChange = useCallback(
    (event: {
      data: { state?: { index: number; routes: { name: string }[] } };
    }) => {
      const navState = event.data.state;
      if (!navState) {
        return;
      }
      const routeName = navState.routes[navState.index]?.name;
      if (routeName && YOU_TAB_NAMES.has(routeName)) {
        lastYouTab = routeName as YouTabName;
      }
    },
    [],
  );

  return (
    <Tab.Navigator
      initialRouteName={readLastYouTab()}
      screenOptions={screenOptions}
      tabBar={renderTabBar}
      screenListeners={{ state: onTabStateChange }}
    >
      {TABS.map(tab => (
        <Tab.Screen
          key={tab.name}
          name={tab.name}
          component={tab.component}
          options={{
            tabBarLabel: tab.label,
            tabBarIcon: tab.tabBarIcon,
          }}
        />
      ))}
    </Tab.Navigator>
  );
}
