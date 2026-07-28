import { memo, useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  View,
  type ListRenderItem,
} from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { SettingsScreenLayout } from '@/components/settings/SettingsScreenLayout';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import {
  listTripDaySummaries,
  type TripDaySummary,
} from '@/db/repositories/trips';
import {
  exportTripKindSummary,
  formatExportDateKeyLabel,
} from '@/lib/export-trip-view';
import type { RootStackParamList } from '@/navigation/types';
import { useThemeColors } from '@/hooks/use-theme-colors';

type TripDayRowProps = {
  item: TripDaySummary;
  iconColor: string;
  onOpen: (dateKey: string) => void;
};

const TripDayRow = memo(function TripDayRow({
  item,
  iconColor,
  onOpen,
}: TripDayRowProps) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => onOpen(item.dateKey)}
      className="border-border bg-card flex-row items-center rounded-2xl border px-4 py-3"
    >
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
      <Icon as={ChevronRight} size={18} color={iconColor} />
    </Pressable>
  );
});

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

  const handleOpenDay = useCallback(
    (dateKey: string) => {
      navigation.navigate('ExportTripDetail', { dateKey, tripIndex: 0 });
    },
    [navigation],
  );

  const keyExtractor = useCallback((item: TripDaySummary) => item.dateKey, []);

  const renderItem = useCallback<ListRenderItem<TripDaySummary>>(
    ({ item }) => (
      <TripDayRow
        item={item}
        iconColor={colors.mutedForeground}
        onOpen={handleOpenDay}
      />
    ),
    [colors.mutedForeground, handleOpenDay],
  );

  const listHeader = (
    <View className="mb-3">
      <Text className="text-base font-semibold">Trips by day</Text>
      <Text variant="muted" className="mt-1 text-sm leading-5">
        Browse materialized trips with local times (America/Chicago). Tap a day
        to step through each segment.
      </Text>
    </View>
  );

  return (
    <SettingsScreenLayout scroll={false}>
      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator />
        </View>
      ) : days.length === 0 ? (
        <View className="flex-1 justify-end px-5 pb-4">
          {listHeader}
          <Text variant="muted" className="text-sm leading-5">
            No trips stored yet. Run trip detection or open the map to
            materialize visits and drives.
          </Text>
        </View>
      ) : (
        <FlatList
          data={days}
          keyExtractor={keyExtractor}
          ListHeaderComponent={listHeader}
          contentContainerStyle={{
            flexGrow: 1,
            justifyContent: 'flex-end',
            paddingHorizontal: 20,
            paddingVertical: 16,
            gap: 8,
          }}
          renderItem={renderItem}
        />
      )}
    </SettingsScreenLayout>
  );
}
