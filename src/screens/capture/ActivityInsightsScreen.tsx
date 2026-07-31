import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
  type ListRenderItem,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { WandSparkles, X } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ActivityEmojiOrb } from '@/components/map/ActivityEmojiOrb';
import { MapGlassCircleButton } from '@/components/map/MapGlassCircleButton';
import { Text } from '@/components/ui/text';
import {
  listActiveActivities,
  type ActivityRow,
} from '@/db/repositories/activities';
import { useThemeColors } from '@/hooks/use-theme-colors';
import {
  MAP_MOMENTS_BAR_GAP,
  MAP_MOMENTS_BAR_HEIGHT,
} from '@/lib/app-constants';
import type { RootStackParamList } from '@/navigation/types';

const GRID_COLUMNS = 4;
const GRID_GAP = 12;
const GRID_HORIZONTAL_PAD = 20;

/**
 * Pick an activity for insights — headerless chrome, content from bottom,
 * title sits above the grid; liquid-glass close at bottom center.
 */
export function ActivityInsightsScreen() {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const [activities, setActivities] = useState<ActivityRow[]>([]);
  const [loading, setLoading] = useState(true);

  const cellWidth = useMemo(
    () =>
      (windowWidth -
        GRID_HORIZONTAL_PAD * 2 -
        GRID_GAP * (GRID_COLUMNS - 1)) /
      GRID_COLUMNS,
    [windowWidth],
  );

  const bottomPad =
    MAP_MOMENTS_BAR_HEIGHT + Math.max(insets.bottom, MAP_MOMENTS_BAR_GAP) + 16;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setActivities(await listActiveActivities());
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const handleClose = useCallback(() => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    }
  }, [navigation]);

  const handleSelect = useCallback(
    (activity: ActivityRow) => {
      navigation.navigate('ActivityInsightDetail', { activityId: activity.id });
    },
    [navigation],
  );

  const listHeader = useMemo(
    () => (
      <View style={styles.intro}>
        <View style={styles.titleRow}>
          <WandSparkles size={18} color={colors.primary} strokeWidth={2.25} />
          <Text style={[styles.title, { color: colors.foreground }]}>
            Activity insights
          </Text>
        </View>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
          Choose an activity to see timing, habit trends, and amounts.
        </Text>
      </View>
    ),
    [colors.foreground, colors.mutedForeground, colors.primary],
  );

  const renderActivityCell = useCallback<ListRenderItem<ActivityRow>>(
    ({ item }) => (
      <View style={{ width: cellWidth }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Insights for ${item.label}`}
          onPress={() => handleSelect(item)}
          style={({ pressed }) => [
            styles.tokenCell,
            pressed ? styles.tokenCellPressed : null,
          ]}
        >
          <ActivityEmojiOrb activity={item} />
          <Text
            numberOfLines={1}
            style={[styles.tokenLabel, { color: colors.foreground }]}
          >
            {item.label}
          </Text>
        </Pressable>
      </View>
    ),
    [cellWidth, colors.foreground, handleSelect],
  );

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : activities.length === 0 ? (
        <View style={[styles.centered, { paddingBottom: bottomPad }]}>
          {listHeader}
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
            No activities yet
          </Text>
          <Text style={[styles.emptyBody, { color: colors.mutedForeground }]}>
            Create an activity first, then come back for insights.
          </Text>
        </View>
      ) : (
        <FlatList
          data={activities}
          keyExtractor={item => String(item.id)}
          numColumns={GRID_COLUMNS}
          ListHeaderComponent={listHeader}
          columnWrapperStyle={styles.gridRow}
          contentContainerStyle={[
            styles.gridContent,
            {
              paddingTop: Math.max(insets.top, 12),
              paddingBottom: bottomPad,
            },
          ]}
          showsVerticalScrollIndicator={false}
          style={styles.grid}
          renderItem={renderActivityCell}
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
          accessibilityLabel="Close"
          onPress={handleClose}
        >
          <X size={20} color={colors.primary} strokeWidth={2.25} />
        </MapGlassCircleButton>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingHorizontal: 24,
  },
  intro: {
    alignItems: 'center',
    marginBottom: 16,
    paddingHorizontal: 8,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 8,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  emptyBody: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  grid: {
    flex: 1,
  },
  gridContent: {
    flexGrow: 1,
    justifyContent: 'flex-end',
    paddingHorizontal: GRID_HORIZONTAL_PAD,
  },
  gridRow: {
    gap: GRID_GAP,
    marginBottom: GRID_GAP,
  },
  tokenCell: {
    alignItems: 'center',
    gap: 5,
    paddingVertical: 4,
  },
  tokenCellPressed: {
    opacity: 0.75,
  },
  tokenLabel: {
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
  },
  closeWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
  },
});
