import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Check, ListFilter } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GalleryDayBlock } from '@/components/gallery/GalleryDayBlock';
import { MapGlassCircleButton } from '@/components/map/MapGlassCircleButton';
import type { MomentRow } from '@/db/repositories/moments';
import {
  useGalleryMoments,
  type GalleryDaySection,
} from '@/hooks/use-gallery-moments';
import { useThemeColors } from '@/hooks/use-theme-colors';
import { warmHistoryForDay } from '@/lib/history-preload';
import {
  GALLERY_TYPE_FILTER_OPTIONS,
  galleryTypeFilterLabel,
  type GalleryTypeFilter,
} from '@/lib/moments/gallery-type-filter';
import { queueMomentPreview } from '@/lib/moments/moment-preview-navigation';
import type { RootStackParamList } from '@/navigation/types';
import {
  MAP_MOMENTS_BAR_GAP,
  MAP_MOMENTS_BAR_HEIGHT,
  MAP_STACK_BUTTON_LEFT,
  MAP_STACK_BUTTON_SIZE,
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

function filterGallerySections(
  sections: GalleryDaySection[],
  typeFilter: GalleryTypeFilter,
): GalleryDaySection[] {
  if (typeFilter === 'all') {
    return sections;
  }
  return sections
    .map(section => ({
      ...section,
      moments: section.moments.filter(moment => moment.type === typeFilter),
    }))
    .filter(section => section.moments.length > 0);
}

export function GalleryScreen() {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { sections, loading, loadingMore, hasMore, loadMoreOlder } =
    useGalleryMoments();
  const [typeFilter, setTypeFilter] = useState<GalleryTypeFilter>('all');
  const [filterMenuOpen, setFilterMenuOpen] = useState(false);

  const filterBottom = Math.max(insets.bottom, MAP_MOMENTS_BAR_GAP);
  const bottomPad =
    filterBottom + MAP_MOMENTS_BAR_HEIGHT + 16;

  const listData = useMemo(
    () => filterGallerySections(sections, typeFilter),
    [sections, typeFilter],
  );

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

  const onPressFilter = useCallback(() => {
    setFilterMenuOpen(open => !open);
  }, []);

  const onSelectFilter = useCallback((filter: GalleryTypeFilter) => {
    setTypeFilter(filter);
    setFilterMenuOpen(false);
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
    const filteredEmpty = typeFilter !== 'all' && sections.length > 0;
    return (
      <View style={styles.empty}>
        <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
          {filteredEmpty ? 'No matching moments' : 'No moments yet'}
        </Text>
        <Text style={[styles.emptyBody, { color: colors.mutedForeground }]}>
          {filteredEmpty
            ? `Nothing in ${galleryTypeFilterLabel(typeFilter)} yet. Try another filter.`
            : 'Photos, videos, notes, voice memos, and activities will show up here.'}
        </Text>
      </View>
    );
  }, [
    colors.foreground,
    colors.mutedForeground,
    loading,
    sections.length,
    typeFilter,
  ]);

  const onEndReached = useCallback(() => {
    if (hasMore && !loadingMore) {
      void loadMoreOlder();
    }
  }, [hasMore, loadMoreOlder, loadingMore]);

  const filterControls = (
    <>
      {filterMenuOpen ? (
        <>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close filter menu"
            onPress={() => setFilterMenuOpen(false)}
            style={styles.filterBackdrop}
          />
          <View
            style={[
              styles.filterMenu,
              {
                bottom: filterBottom + MAP_STACK_BUTTON_SIZE + 10,
                backgroundColor: colors.card,
                borderColor: colors.border,
              },
            ]}
          >
            <Text
              style={[
                styles.filterMenuTitle,
                { color: colors.mutedForeground },
              ]}
            >
              Show moments
            </Text>
            {GALLERY_TYPE_FILTER_OPTIONS.map(option => {
              const selected = option.value === typeFilter;
              return (
                <Pressable
                  key={option.value}
                  accessibilityRole="menuitem"
                  accessibilityState={{ selected }}
                  onPress={() => onSelectFilter(option.value)}
                  style={[
                    styles.filterMenuItem,
                    selected
                      ? { backgroundColor: colors.accent }
                      : undefined,
                  ]}
                >
                  <Text
                    style={[
                      styles.filterMenuItemLabel,
                      {
                        color: selected
                          ? colors.primary
                          : colors.cardForeground,
                      },
                    ]}
                  >
                    {option.label}
                  </Text>
                  {selected ? (
                    <Check
                      size={17}
                      color={colors.primary}
                      strokeWidth={2.5}
                    />
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        </>
      ) : null}
      <View
        pointerEvents="box-none"
        style={[styles.filterSlot, { bottom: filterBottom }]}
      >
        <MapGlassCircleButton
          accessibilityLabel={`Filter gallery, ${galleryTypeFilterLabel(typeFilter)}`}
          onPress={onPressFilter}
          style={styles.filterButton}
        >
          <ListFilter size={20} color={colors.primary} strokeWidth={2.25} />
        </MapGlassCircleButton>
        {typeFilter !== 'all' ? (
          <View pointerEvents="none" style={styles.filterDot} />
        ) : null}
      </View>
    </>
  );

  if (loading && sections.length === 0) {
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
        {filterControls}
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
      {filterControls}
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
  filterBackdrop: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 20,
  },
  filterMenu: {
    position: 'absolute',
    left: MAP_STACK_BUTTON_LEFT,
    zIndex: 21,
    width: 190,
    padding: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 12,
  },
  filterMenuTitle: {
    paddingHorizontal: 10,
    paddingTop: 7,
    paddingBottom: 5,
    fontSize: 12,
    fontWeight: '600',
  },
  filterMenuItem: {
    minHeight: 40,
    paddingHorizontal: 10,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  filterMenuItemLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
  filterSlot: {
    position: 'absolute',
    left: MAP_STACK_BUTTON_LEFT,
    zIndex: 22,
    width: MAP_STACK_BUTTON_SIZE,
    height: MAP_MOMENTS_BAR_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterButton: {
    width: MAP_STACK_BUTTON_SIZE,
    height: MAP_STACK_BUTTON_SIZE,
  },
  filterDot: {
    position: 'absolute',
    top: 9,
    right: 9,
    width: 10,
    height: 10,
    borderRadius: 6,
    backgroundColor: '#FF3B30',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    zIndex: 2,
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
