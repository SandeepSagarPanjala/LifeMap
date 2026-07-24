import { useCallback, useMemo } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GalleryDayBlock } from '@/components/gallery/GalleryDayBlock';
import type { MomentRow } from '@/db/repositories/moments';
import {
  useGalleryMoments,
  type GalleryDaySection,
} from '@/hooks/use-gallery-moments';
import { useThemeColors } from '@/hooks/use-theme-colors';
import { warmHistoryForDay } from '@/lib/history-preload';
import { queueMomentPreview } from '@/lib/moments/moment-preview-navigation';
import type { RootStackParamList } from '@/navigation/types';
import {
  MAP_MOMENTS_BAR_GAP,
  MAP_MOMENTS_BAR_HEIGHT,
} from '@/lib/app-constants';

const SKELETON_COUNT = 4;

function GallerySkeleton({ color }: { color: string }) {
  return (
    <View style={styles.skeletonRoot}>
      {Array.from({ length: SKELETON_COUNT }, (_, i) => (
        <View key={i} style={styles.skeletonBlock}>
          <View style={[styles.skeletonStripe, { backgroundColor: color }]} />
          <View style={styles.skeletonGrid}>
            {Array.from({ length: 6 }, (_unused, j) => (
              <View
                key={j}
                style={[styles.skeletonTile, { backgroundColor: color }]}
              />
            ))}
          </View>
        </View>
      ))}
    </View>
  );
}

export function GalleryScreen() {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { sections, loading, loadingMore, hasMore, loadMoreOlder } =
    useGalleryMoments();

  const bottomPad =
    Math.max(insets.bottom, MAP_MOMENTS_BAR_GAP) + MAP_MOMENTS_BAR_HEIGHT + 16;

  // FlashList inverted: index 0 sits at the visual bottom → newest first.
  const listData = sections;

  const onPressMoment = useCallback(
    (section: GalleryDaySection, _moment: MomentRow, indexInDay: number) => {
      queueMomentPreview({
        moments: section.moments,
        initialIndex: indexInDay,
        dateKey: section.dateKey,
        crossDayExpand: true,
      });
      navigation.navigate('MomentPreview');
    },
    [navigation],
  );

  const onPressDayMap = useCallback(
    (dateKey: string) => {
      warmHistoryForDay(dateKey);
      navigation.navigate('GalleryDayJourney', { dateKey });
    },
    [navigation],
  );

  const onWarmDayMap = useCallback((dateKey: string) => {
    warmHistoryForDay(dateKey);
  }, []);

  const renderItem = useCallback(
    ({ item }: { item: GalleryDaySection }) => (
      <GalleryDayBlock
        section={item}
        onPressMoment={(moment, indexInDay) =>
          onPressMoment(item, moment, indexInDay)
        }
        onPressDayMap={onPressDayMap}
        onWarmDayMap={onWarmDayMap}
      />
    ),
    [onPressDayMap, onPressMoment, onWarmDayMap],
  );

  const keyExtractor = useCallback(
    (item: GalleryDaySection) => item.dateKey,
    [],
  );

  const ListEmpty = useMemo(() => {
    if (loading) {
      return null;
    }
    return (
      <View style={styles.empty}>
        <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
          No moments yet
        </Text>
        <Text style={[styles.emptyBody, { color: colors.mutedForeground }]}>
          Photos, videos, notes, voice memos, and activities will show up here.
        </Text>
      </View>
    );
  }, [colors.foreground, colors.mutedForeground, loading]);

  const onEndReached = useCallback(() => {
    if (hasMore && !loadingMore) {
      void loadMoreOlder();
    }
  }, [hasMore, loadMoreOlder, loadingMore]);

  if (loading && listData.length === 0) {
    return (
      <View
        style={[
          styles.root,
          {
            backgroundColor: colors.background,
            paddingTop: insets.top,
            paddingBottom: bottomPad,
          },
        ]}
      >
        <GallerySkeleton color={colors.border} />
      </View>
    );
  }

  return (
    <View
      style={[
        styles.root,
        {
          backgroundColor: colors.background,
          paddingTop: insets.top,
        },
      ]}
    >
      <FlashList
        data={listData}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        inverted
        onEndReached={onEndReached}
        onEndReachedThreshold={0.4}
        contentContainerStyle={{ paddingTop: bottomPad }}
        ListEmptyComponent={ListEmpty}
        ListFooterComponent={
          loadingMore ? (
            <View style={styles.footer}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  empty: {
    paddingHorizontal: 32,
    paddingVertical: 48,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  emptyBody: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  footer: {
    paddingVertical: 16,
  },
  skeletonRoot: {
    paddingTop: 8,
  },
  skeletonBlock: {
    marginBottom: 16,
  },
  skeletonStripe: {
    height: 18,
    width: 140,
    borderRadius: 6,
    marginLeft: 16,
    marginBottom: 10,
    opacity: 0.55,
  },
  skeletonGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 2,
  },
  skeletonTile: {
    width: '32.5%',
    aspectRatio: 1,
    opacity: 0.45,
  },
});
