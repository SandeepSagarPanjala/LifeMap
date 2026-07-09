import {useCallback, useEffect, useState} from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  View,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {ChevronRight} from 'lucide-react-native';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';

import {Icon} from '@/components/ui/icon';
import {Text} from '@/components/ui/text';
import {
  listTripDaySummaries,
  type TripDaySummary,
} from '@/db/repositories/trips';
import {
  exportTripKindSummary,
  formatExportDateKeyLabel,
} from '@/lib/export-trip-view';
import type {RootStackParamList} from '@/navigation/types';
import {useThemeColors} from '@/hooks/use-theme-colors';

export function ExportTripDaysScreen() {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const colors = useThemeColors();
  const [days, setDays] = useState<TripDaySummary[]>([]);
  const [loading, setLoading] = useState(true);

  const loadDays = useCallback(async () => {
    setLoading(true);
    try {
      setDays(await listTripDaySummaries());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDays();
  }, [loadDays]);

  return (
    <SafeAreaView className="bg-background flex-1" edges={['bottom']}>
      <View className="border-border border-b px-5 py-4">
        <Text className="text-base font-semibold">Trips by day</Text>
        <Text variant="muted" className="mt-1 text-sm leading-5">
          Browse materialized trips with local times ({' '}
          <Text className="text-xs">America/Chicago</Text>). Tap a day to step
          through each segment.
        </Text>
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator />
        </View>
      ) : days.length === 0 ? (
        <View className="flex-1 items-center justify-center px-8">
          <Text variant="muted" className="text-center text-sm leading-5">
            No trips stored yet. Run trip detection or open the map to materialize
            visits and drives.
          </Text>
        </View>
      ) : (
        <FlatList
          data={days}
          keyExtractor={item => item.dateKey}
          contentContainerClassName="px-5 py-4 gap-2"
          renderItem={({item}) => (
            <Pressable
              accessibilityRole="button"
              onPress={() =>
                navigation.navigate('ExportTripDetail', {
                  dateKey: item.dateKey,
                  tripIndex: 0,
                })
              }
              className="border-border bg-card flex-row items-center rounded-2xl border px-4 py-3">
              <View className="min-w-0 flex-1">
                <Text className="text-sm font-semibold">
                  {formatExportDateKeyLabel(item.dateKey)}
                </Text>
                <Text variant="muted" className="mt-1 text-xs leading-4">
                  {item.tripCount.toLocaleString()} segment
                  {item.tripCount === 1 ? '' : 's'} ·{' '}
                  {exportTripKindSummary(
                    item.stayCount,
                    item.travelCount,
                    item.missingCount,
                  )}
                </Text>
                <Text variant="muted" className="mt-0.5 text-[11px]">
                  {item.dateKey}
                </Text>
              </View>
              <Icon as={ChevronRight} size={18} color={colors.mutedForeground} />
            </Pressable>
          )}
        />
      )}
    </SafeAreaView>
  );
}
