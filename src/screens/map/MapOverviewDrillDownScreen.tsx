import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text as RNText,
  View,
  type ListRenderItem,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ChevronLeft } from 'lucide-react-native';
import { MapPinArea } from 'phosphor-react-native/src/icons/MapPinArea';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MapGlassCircleButton } from '@/components/map/MapGlassCircleButton';
import { Text } from '@/components/ui/text';
import { listSavedPlaces } from '@/db/repositories/saved-places';
import { listAllTrips } from '@/db/repositories/trips';
import { useThemeColors } from '@/hooks/use-theme-colors';
import { APP_COPY } from '@/lib/app-copy';
import {
  MAP_MOMENTS_BAR_GAP,
  MAP_MOMENTS_BAR_HEIGHT,
} from '@/lib/app-constants';
import { formatGalleryDayLabel } from '@/lib/gallery-day-label';
import { warmHistoryForDay } from '@/lib/history-preload';
import {
  listMapOverviewDrillRows,
  type MapOverviewDrillRow,
} from '@/lib/map/map-overview-insights';
import type { RootStackParamList } from '@/navigation/types';

const THEME = {
  tint: '#F0FDFA',
  strong: '#0D9488',
};

/**
 * Justifies a clickable Map Overview metric with the underlying stays/commutes.
 */
export function MapOverviewDrillDownScreen() {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route =
    useRoute<RouteProp<RootStackParamList, 'MapOverviewDrillDown'>>();
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const { kind, title, weekday, placeId } = route.params;

  const [rows, setRows] = useState<MapOverviewDrillRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      try {
        const [trips, savedPlaces] = await Promise.all([
          listAllTrips(),
          listSavedPlaces(),
        ]);
        if (cancelled) {
          return;
        }
        setRows(
          listMapOverviewDrillRows({
            kind,
            trips,
            savedPlaces,
            weekday,
            placeId,
          }),
        );
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [kind, weekday, placeId]);

  const handleClose = useCallback(() => {
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }
    navigation.navigate('MapInsights');
  }, [navigation]);

  const openDayMap = useCallback(
    (dateKey: string) => {
      warmHistoryForDay(dateKey);
      navigation.navigate('GalleryDayJourney', { dateKey });
    },
    [navigation],
  );

  const renderItem: ListRenderItem<MapOverviewDrillRow> = useCallback(
    ({ item }) => {
      const dayLabel = formatGalleryDayLabel(item.dateKey);
      return (
        <View style={[styles.row, { backgroundColor: THEME.tint }]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Open ${dayLabel} journey map`}
            onPressIn={() => warmHistoryForDay(item.dateKey)}
            onPress={() => openDayMap(item.dateKey)}
            style={({ pressed }) => [
              styles.rowMain,
              { opacity: pressed ? 0.72 : 1 },
            ]}
          >
            <View style={styles.rowText}>
              <Text
                style={[styles.rowTitle, { color: colors.foreground }]}
                numberOfLines={2}
              >
                {item.subtitle}
              </Text>
              <RNText
                style={[styles.rowValue, { color: THEME.strong }]}
                allowFontScaling={false}
                numberOfLines={1}
              >
                {item.valueLabel}
              </RNText>
            </View>
            <MapPinArea
              size={20}
              color={colors.primary}
              weight="duotone"
              duotoneColor={colors.primary}
              duotoneOpacity={0.35}
            />
          </Pressable>
        </View>
      );
    },
    [colors.foreground, colors.primary, openDayMap],
  );

  const bottomPad =
    MAP_MOMENTS_BAR_HEIGHT + Math.max(insets.bottom, MAP_MOMENTS_BAR_GAP) + 16;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View
        style={[
          styles.header,
          {
            paddingTop: Math.max(insets.top, 12),
            backgroundColor: THEME.tint,
          },
        ]}
      >
        <RNText
          style={[styles.headerTitle, { color: colors.foreground }]}
          numberOfLines={2}
          allowFontScaling={false}
        >
          {title}
        </RNText>
        <Text style={[styles.headerMeta, { color: colors.mutedForeground }]}>
          {loading
            ? '…'
            : rows.length === 1
              ? '1 entry'
              : `${rows.length} entries`}
        </Text>
      </View>

      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          contentContainerStyle={[
            styles.list,
            { paddingBottom: bottomPad },
            rows.length === 0 ? styles.listEmpty : null,
          ]}
          ListEmptyComponent={
            <Text style={[styles.empty, { color: colors.mutedForeground }]}>
              {APP_COPY.mapInsights.overviewDrillEmpty}
            </Text>
          }
          showsVerticalScrollIndicator={false}
        />
      )}

      <View
        pointerEvents="box-none"
        style={[
          styles.closeWrap,
          { paddingBottom: Math.max(insets.bottom, MAP_MOMENTS_BAR_GAP) },
        ]}
      >
        <MapGlassCircleButton
          accessibilityLabel="Back"
          onPress={handleClose}
        >
          <ChevronLeft size={22} color={colors.primary} strokeWidth={2.25} />
        </MapGlassCircleButton>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 14,
    gap: 4,
  },
  headerTitle: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '800',
  },
  headerMeta: {
    fontSize: 13,
    fontWeight: '600',
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: {
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 10,
  },
  listEmpty: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  row: {
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  rowMain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  rowText: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  rowTitle: {
    flex: 1,
    minWidth: 0,
    fontSize: 14,
    fontWeight: '600',
  },
  rowValue: {
    fontSize: 14,
    fontWeight: '800',
  },
  empty: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    paddingHorizontal: 24,
  },
  closeWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
  },
});
