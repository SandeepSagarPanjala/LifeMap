import { Construction } from 'lucide-react-native';
import { Image } from 'phosphor-react-native/src/icons/Image';
import { MagicWand } from 'phosphor-react-native/src/icons/MagicWand';
import { Trophy } from 'phosphor-react-native/src/icons/Trophy';
import { UserCircle } from 'phosphor-react-native/src/icons/UserCircle';
import { UsersThree } from 'phosphor-react-native/src/icons/UsersThree';
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
import type { PhosphorIcon } from '@/lib/profile/phosphor-icon';
import { ProfileScreen } from '@/screens/you/ProfileScreen';
import {
  isYouTabName,
  readLastYouTab,
  rememberTabBeforeInsightsPress,
  rememberYouTab,
  type YouTabName,
  type YouTabParamList,
} from '@/screens/you/you-tabs';

export type { YouTabParamList } from '@/screens/you/you-tabs';
export { getYouTabBeforeInsights } from '@/screens/you/you-tabs';

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
  return <TabIcon as={MagicWand} {...props} />;
}

function FriendsTabIcon(props: TabBarIconProps) {
  return <TabIcon as={UsersThree} {...props} />;
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

/**
 * Lazy so FlashList + gallery DB stack are not evaluated on first You open
 * (Metro inlineRequires would otherwise pull them in with YouScreen).
 */
function GalleryTabScreen() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const GalleryScreen =
    require('@/screens/you/GalleryScreen').GalleryScreen as ComponentType;
  return <GalleryScreen />;
}

function InsightsTabScreen() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const InsightsScreen =
    require('@/screens/you/InsightsScreen').InsightsScreen as ComponentType;
  return <InsightsScreen />;
}

function AchievementsTabScreen() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const AchievementsScreen =
    require('@/screens/you/AchievementsScreen')
      .AchievementsScreen as ComponentType;
  return <AchievementsScreen />;
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
    component: GalleryTabScreen,
  },
  {
    name: 'Insights',
    label: 'Insights',
    tabBarIcon: InsightsTabIcon,
    component: InsightsTabScreen,
  },
  {
    name: 'Friends',
    label: 'Friends',
    tabBarIcon: FriendsTabIcon,
    component: YouTabPlaceholder,
  },
  {
    name: 'Achievements',
    label: 'Achievements',
    tabBarIcon: AchievementsTabIcon,
    component: AchievementsTabScreen,
  },
];

const Tab = createBottomTabNavigator<YouTabParamList>();

export function YouScreen() {
  const screenOptions = useMemo(
    () => ({
      headerShown: false,
      lazy: true,
    }),
    [],
  );

  const renderTabBar = useCallback(
    (props: ComponentProps<typeof LiquidGlassTabBar>) => {
      const routeName = props.state.routes[props.state.index]?.name;
      // Insights has its own category bar + back; hide the You tab bar.
      if (routeName === 'Insights') {
        return null;
      }
      return <LiquidGlassTabBar {...props} />;
    },
    [],
  );

  /**
   * `state` does not reliably fire for leaf tab switches. Use focus (after
   * switch) and Insights `tabPress` (before switch) so back restores the prior
   * tab — e.g. Achievements → Insights → back → Achievements.
   */
  const screenListeners = useCallback(
    ({ route }: { route: { name: string } }) => ({
      focus: () => {
        if (!isYouTabName(route.name)) {
          return;
        }
        rememberYouTab(route.name);
      },
      tabPress: () => {
        if (route.name !== 'Insights') {
          return;
        }
        rememberTabBeforeInsightsPress();
      },
    }),
    [],
  );

  return (
    <Tab.Navigator
      initialRouteName={readLastYouTab()}
      screenOptions={screenOptions}
      tabBar={renderTabBar}
      screenListeners={screenListeners}
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
