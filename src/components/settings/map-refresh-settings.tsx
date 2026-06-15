import {RefreshCw} from 'lucide-react-native';
import {Pressable, View} from 'react-native';

import {Icon} from '@/components/ui/icon';
import {Text} from '@/components/ui/text';
import {useThemeColors} from '@/hooks/use-theme-colors';
import {useAppStore} from '@/stores/app-store';

export function MapRefreshSettings() {
  const colors = useThemeColors();
  const bumpMapRefresh = useAppStore(state => state.bumpMapRefresh);

  return (
    <View className="bg-card border-border rounded-2xl border p-4">
      <View className="flex-row items-center gap-3">
        <Icon as={RefreshCw} size={20} color={colors.primary} />
        <View className="flex-1">
          <Text className="font-medium">Refresh map</Text>
          <Text variant="muted" className="mt-1 text-sm leading-5">
            Reload today&apos;s timeline and redraw the map if something looks
            missing or stale.
          </Text>
        </View>
      </View>
      <Pressable
        accessibilityRole="button"
        onPress={() => bumpMapRefresh()}
        className="bg-primary mt-4 items-center rounded-xl px-4 py-3">
        <Text className="font-semibold text-primary-foreground">
          Refresh map & timeline
        </Text>
      </Pressable>
    </View>
  );
}
