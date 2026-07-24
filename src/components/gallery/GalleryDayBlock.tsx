import { MapPinArea } from 'phosphor-react-native/src/icons/MapPinArea';
import { memo, useMemo } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import {
  GalleryMomentTile,
  GALLERY_GRID_INSET,
  GALLERY_TILE_COLUMNS,
  GALLERY_TILE_GAP,
} from '@/components/gallery/GalleryMomentTile';
import type { MomentRow } from '@/db/repositories/moments';
import type { GalleryDaySection } from '@/lib/moments/gallery-moments-cache';
import { formatGalleryDayLabel } from '@/lib/gallery-day-label';
import { useThemeColors } from '@/hooks/use-theme-colors';

type GalleryDayBlockProps = {
  section: GalleryDaySection;
  onPressMoment: (moment: MomentRow, indexInDay: number) => void;
  onPressDayMap: (dateKey: string) => void;
  onWarmDayMap?: (dateKey: string) => void;
};

function GalleryDayBlockComponent({
  section,
  onPressMoment,
  onPressDayMap,
  onWarmDayMap,
}: GalleryDayBlockProps) {
  const colors = useThemeColors();
  const { width: windowWidth } = useWindowDimensions();
  const tileSize = useMemo(() => {
    const innerWidth = windowWidth - GALLERY_GRID_INSET * 2;
    const gaps = GALLERY_TILE_GAP * (GALLERY_TILE_COLUMNS - 1);
    return Math.floor((innerWidth - gaps) / GALLERY_TILE_COLUMNS);
  }, [windowWidth]);

  const label = useMemo(
    () => formatGalleryDayLabel(section.dateKey),
    [section.dateKey],
  );

  return (
    <View style={styles.block}>
      <View style={styles.header}>
        <Text style={[styles.dateLabel, { color: colors.foreground }]}>
          {label}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Open ${label} journey map`}
          hitSlop={8}
          onPressIn={() => onWarmDayMap?.(section.dateKey)}
          onPress={() => onPressDayMap(section.dateKey)}
          style={styles.mapIconHit}
        >
          <MapPinArea
            size={20}
            color={colors.primary}
            weight="duotone"
            duotoneColor={colors.primary}
            duotoneOpacity={0.35}
          />
        </Pressable>
      </View>

      <View style={styles.grid}>
        {section.moments.map((moment, index) => {
          const col = index % GALLERY_TILE_COLUMNS;
          return (
            <View
              key={moment.id}
              style={{
                marginLeft: col === 0 ? GALLERY_GRID_INSET : GALLERY_TILE_GAP,
                marginRight:
                  col === GALLERY_TILE_COLUMNS - 1 ? GALLERY_GRID_INSET : 0,
                marginBottom: GALLERY_TILE_GAP,
              }}
            >
              <GalleryMomentTile
                moment={moment}
                size={tileSize}
                placeLabel={
                  section.placeLabelsByMomentId.get(moment.id) ?? null
                }
                onPress={() => onPressMoment(moment, index)}
              />
            </View>
          );
        })}
      </View>
    </View>
  );
}

export const GalleryDayBlock = memo(GalleryDayBlockComponent);

const styles = StyleSheet.create({
  block: {
    paddingBottom: 18,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: GALLERY_GRID_INSET,
    paddingTop: 10,
    paddingBottom: 10,
  },
  dateLabel: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  mapIconHit: {
    padding: 4,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
});
