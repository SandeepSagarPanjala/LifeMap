import type {BottomTabBarProps} from '@react-navigation/bottom-tabs';
import {Clock, Map as MapIcon, Settings, Sparkles, type LucideIcon} from 'lucide-react-native';
import {Pressable, View} from 'react-native';

import {Text} from '@/components/ui/text';
import type {TabRoute} from '@/lib/constants';
import {cn} from '@/lib/utils';

const TAB_ICONS: Record<TabRoute, LucideIcon> = {
  Home: Sparkles,
  Map: MapIcon,
  Timeline: Clock,
  Settings: Settings,
};

const TAB_LABELS: Record<TabRoute, string> = {
  Home: 'Today',
  Map: 'Map',
  Timeline: 'Timeline',
  Settings: 'Settings',
};

export function CustomTabBar({state, navigation, insets}: BottomTabBarProps) {
  return (
    <View
      className="border-border bg-card flex-row border-t px-2 pt-2"
      style={{paddingBottom: Math.max(insets.bottom, 8)}}>
      {state.routes.map((route, index) => {
        const isFocused = state.index === index;
        const routeName = route.name as TabRoute;
        const Icon = TAB_ICONS[routeName];

        const onPress = () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });

          if (!isFocused && !event.defaultPrevented) {
            navigation.navigate(route.name, route.params);
          }
        };

        return (
          <Pressable
            key={route.key}
            accessibilityRole="button"
            accessibilityState={isFocused ? {selected: true} : {}}
            accessibilityLabel={TAB_LABELS[routeName]}
            onPress={onPress}
            className="flex-1 items-center justify-center gap-1 py-2">
            <Icon
              size={22}
              color={isFocused ? 'hsl(16 65% 45%)' : 'hsl(24 8% 45%)'}
              strokeWidth={isFocused ? 2.5 : 2}
            />
            <Text
              className={cn(
                'text-xs font-medium',
                isFocused ? 'text-primary' : 'text-muted-foreground'
              )}>
              {TAB_LABELS[routeName]}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
