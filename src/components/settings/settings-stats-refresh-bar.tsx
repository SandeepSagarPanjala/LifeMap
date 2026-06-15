import {format} from 'date-fns';
import {ActivityIndicator, Pressable, View} from 'react-native';

import {Text} from '@/components/ui/text';

type SettingsStatsRefreshBarProps = {
  calculatedAt: Date | null;
  calculating: boolean;
  onCalculate: () => void;
};

export function SettingsStatsRefreshBar({
  calculatedAt,
  calculating,
  onCalculate,
}: SettingsStatsRefreshBarProps) {
  return (
    <View className="mt-4 flex-row items-center gap-3">
      <View className="min-w-0 flex-1">
        {calculatedAt != null ? (
          <Text variant="muted" className="text-xs leading-4">
            Last calculated {format(calculatedAt, 'MMM d, yyyy · h:mm a')}
          </Text>
        ) : (
          <Text variant="muted" className="text-xs leading-4">
            Not calculated yet. Tap Calculate to scan this device.
          </Text>
        )}
      </View>
      <Pressable
        accessibilityRole="button"
        disabled={calculating}
        onPress={onCalculate}
        className={`border-border rounded-full border px-3 py-2 ${
          calculating ? 'opacity-50' : ''
        }`}>
        {calculating ? (
          <ActivityIndicator />
        ) : (
          <Text className="text-sm font-medium">
            {calculatedAt != null ? 'Recalculate' : 'Calculate'}
          </Text>
        )}
      </Pressable>
    </View>
  );
}
