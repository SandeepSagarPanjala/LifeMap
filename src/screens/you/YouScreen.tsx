import {
  Boxes,
  ChartNoAxesCombined,
  Construction,
  Images,
  Menu,
  UserRound,
  type LucideIcon,
} from 'lucide-react-native';
import {
  useCallback,
  useMemo,
  useState,
  type ComponentProps,
  type ReactElement,
} from 'react';
import { Modal, Pressable, View } from 'react-native';
import {
  createBottomTabNavigator,
  type BottomTabScreenProps,
} from '@react-navigation/bottom-tabs';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LiquidGlassTabBar } from '@/components/you/LiquidGlassTabBar';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useThemeColors } from '@/hooks/use-theme-colors';

export type YouTabParamList = {
  Profile: undefined;
  Gallery: undefined;
  Insights: undefined;
  Batches: undefined;
  More: undefined;
};

type YouPrimaryTab = keyof Omit<YouTabParamList, 'More'>;

type TabBarIconProps = {
  color: string;
  size: number;
};

function ProfileTabIcon({ color, size }: TabBarIconProps) {
  return <Icon as={UserRound} size={size} color={color} />;
}

function GalleryTabIcon({ color, size }: TabBarIconProps) {
  return <Icon as={Images} size={size} color={color} />;
}

function InsightsTabIcon({ color, size }: TabBarIconProps) {
  return <Icon as={ChartNoAxesCombined} size={size} color={color} />;
}

function BatchesTabIcon({ color, size }: TabBarIconProps) {
  return <Icon as={Boxes} size={size} color={color} />;
}

function MoreTabIcon({ color, size }: TabBarIconProps) {
  return <Icon as={Menu} size={size} color={color} />;
}

const PRIMARY_TABS: {
  name: YouPrimaryTab;
  label: string;
  tabBarIcon: (props: TabBarIconProps) => ReactElement;
}[] = [
  { name: 'Profile', label: 'Profile', tabBarIcon: ProfileTabIcon },
  { name: 'Gallery', label: 'Gallery', tabBarIcon: GalleryTabIcon },
  { name: 'Insights', label: 'Insights', tabBarIcon: InsightsTabIcon },
  { name: 'Batches', label: 'Batches', tabBarIcon: BatchesTabIcon },
];

/** Grow this list as new You pages are added — they appear in the More menu. */
const OVERFLOW_ITEMS: {
  id: string;
  label: string;
  icon: LucideIcon;
}[] = [];

const Tab = createBottomTabNavigator<YouTabParamList>();

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
  navigation,
}: BottomTabScreenProps<YouTabParamList>) {
  useFocusEffect(
    useCallback(() => {
      navigation.getParent()?.setOptions({ title: route.name });
    }, [navigation, route.name]),
  );

  return <UnderDevelopmentPanel title={route.name} />;
}

function MoreMenuSheet({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Dismiss menu"
        onPress={onClose}
        className="flex-1 justify-end bg-black/35"
      >
        <Pressable
          onPress={event => event.stopPropagation()}
          className="border-border bg-card mx-3 overflow-hidden rounded-2xl border"
          style={{ marginBottom: Math.max(insets.bottom, 12) + 56 }}
        >
          <View className="border-border border-b px-4 py-3">
            <Text className="text-sm font-semibold">More</Text>
          </View>

          {OVERFLOW_ITEMS.length === 0 ? (
            <View className="px-4 py-5">
              <Text variant="muted" className="text-center">
                More pages coming soon
              </Text>
            </View>
          ) : (
            OVERFLOW_ITEMS.map(item => (
              <Pressable
                key={item.id}
                accessibilityRole="button"
                accessibilityLabel={item.label}
                onPress={onClose}
                className="border-border flex-row items-center gap-3 border-b px-4 py-3.5 active:bg-muted/50"
              >
                <Icon
                  as={item.icon}
                  size={20}
                  color={colors.mutedForeground}
                />
                <Text className="flex-1 text-base">{item.label}</Text>
              </Pressable>
            ))
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export function YouScreen() {
  const [moreOpen, setMoreOpen] = useState(false);

  const openMore = useCallback(() => {
    setMoreOpen(true);
  }, []);

  const closeMore = useCallback(() => {
    setMoreOpen(false);
  }, []);

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

  return (
    <>
      <Tab.Navigator screenOptions={screenOptions} tabBar={renderTabBar}>
        {PRIMARY_TABS.map(tab => (
          <Tab.Screen
            key={tab.name}
            name={tab.name}
            component={YouTabPlaceholder}
            options={{
              tabBarLabel: tab.label,
              tabBarIcon: tab.tabBarIcon,
            }}
          />
        ))}
        <Tab.Screen
          name="More"
          component={YouTabPlaceholder}
          listeners={{
            tabPress: event => {
              event.preventDefault();
              openMore();
            },
          }}
          options={{
            tabBarLabel: 'More',
            tabBarIcon: MoreTabIcon,
            tabBarBadge: '',
          }}
        />
      </Tab.Navigator>

      <MoreMenuSheet visible={moreOpen} onClose={closeMore} />
    </>
  );
}
