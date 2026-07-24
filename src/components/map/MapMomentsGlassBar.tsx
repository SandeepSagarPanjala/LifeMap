import {
  Activity,
  AudioLines,
  Book,
  Camera,
  LayoutGrid,
  Search,
  type LucideIcon,
} from 'lucide-react-native';
import { memo } from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { GlassSurface } from '@/components/glass/GlassSurface';
import { MapGlassCircleButton } from '@/components/map/MapGlassCircleButton';
import { useThemeColors } from '@/hooks/use-theme-colors';
import {
  MAP_MOMENTS_BAR_HEIGHT,
  MAP_MOMENTS_DATE_LABEL_GAP,
  MAP_MOMENTS_DATE_LABEL_HEIGHT,
  MAP_STACK_BUTTON_RIGHT,
  MAP_STACK_BUTTON_SIZE,
} from '@/lib/app-constants';

type MapMomentsGlassBarProps = {
  bottom: number;
  dateLabel: string;
  canGoPrev: boolean;
  onPrevDay: () => void;
  onPressDate: () => void;
  onCamera: () => void;
  onVoice: () => void;
  onNote: () => void;
  onActivity: () => void;
  onYou: () => void;
};

type MomentAction = {
  key: string;
  icon: LucideIcon;
  label: string;
  onPress: () => void;
};

const TAB_SIZE = 44;
const ICON_SIZE = 20;
const H_PADDING = 4;

/** Long-shaft left arrow (←────) for the date prev control. */
function LongLeftArrow({ color, opacity }: { color: string; opacity: number }) {
  return (
    <View style={[styles.longArrow, { opacity }]}>
      <View style={[styles.longArrowHead, { borderRightColor: color }]} />
      <View style={[styles.longArrowShaft, { backgroundColor: color }]} />
    </View>
  );
}

export const MapMomentsGlassBar = memo(function MapMomentsGlassBar({
  bottom,
  dateLabel,
  canGoPrev,
  onPrevDay,
  onPressDate,
  onCamera,
  onVoice,
  onNote,
  onActivity,
  onYou,
}: MapMomentsGlassBarProps) {
  const colors = useThemeColors();
  const accent = colors.primary;

  // Left → right: You, Diary, Activity, Voice, Camera
  const actions: MomentAction[] = [
    { key: 'you', icon: LayoutGrid, label: 'Open You', onPress: onYou },
    { key: 'note', icon: Book, label: 'Open diary', onPress: onNote },
    { key: 'activity', icon: Activity, label: 'Log an activity', onPress: onActivity },
    { key: 'voice', icon: AudioLines, label: 'Record a voice memo', onPress: onVoice },
    { key: 'camera', icon: Camera, label: 'Take a photo', onPress: onCamera },
  ];

  const dateBottom =
    bottom + MAP_MOMENTS_BAR_HEIGHT + MAP_MOMENTS_DATE_LABEL_GAP;

  return (
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
      <View
        pointerEvents="box-none"
        style={[styles.dateRow, { bottom: dateBottom }]}
      >
        {/* Arrow + matching spacer keep "Today" truly screen-centered. */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Previous day"
          disabled={!canGoPrev}
          onPress={onPrevDay}
          hitSlop={10}
          style={styles.prevArrowHit}
        >
          <LongLeftArrow color={accent} opacity={canGoPrev ? 1 : 0.35} />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Choose date"
          onPress={onPressDate}
          hitSlop={8}
        >
          <Text style={[styles.dateLabel, { color: accent }]} numberOfLines={1}>
            {dateLabel}
          </Text>
        </Pressable>
        <View pointerEvents="none" style={styles.prevArrowSpacer} />
      </View>

      <View pointerEvents="box-none" style={[styles.pillRow, { bottom }]}>
        <View style={styles.shadowWrap}>
          <GlassSurface style={styles.pill}>
            {actions.map(action => {
              const ActionIcon = action.icon;

              return (
                <Pressable
                  key={action.key}
                  accessibilityRole="button"
                  accessibilityLabel={action.label}
                  onPress={action.onPress}
                  style={styles.tab}
                >
                  <ActionIcon size={ICON_SIZE} color={accent} strokeWidth={2} />
                </Pressable>
              );
            })}
          </GlassSurface>
        </View>
      </View>

      <View
        pointerEvents="box-none"
        style={[styles.sideSlot, styles.sideRight, { bottom }]}
      >
        <MapGlassCircleButton
          accessibilityLabel="Search"
          onPress={() => {
            // Placeholder — search not wired yet.
          }}
        >
          <Search size={20} color={colors.primary} strokeWidth={2.25} />
        </MapGlassCircleButton>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  dateRow: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: MAP_MOMENTS_DATE_LABEL_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  prevArrowHit: {
    paddingVertical: 4,
    paddingRight: 6,
    // Same width as spacer so the date label stays optically centered.
    width: 36,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  prevArrowSpacer: {
    width: 36,
  },
  longArrow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  longArrowHead: {
    width: 0,
    height: 0,
    borderTopWidth: 5,
    borderBottomWidth: 5,
    borderRightWidth: 7,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
    marginRight: -1,
  },
  longArrowShaft: {
    width: 22,
    height: 2.5,
    borderRadius: 1.25,
  },
  dateLabel: {
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    textShadowColor: 'rgba(255,255,255,0.85)',
    textShadowOffset: { width: 0, height: 0.5 },
    textShadowRadius: 2,
  },
  pillRow: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: MAP_MOMENTS_BAR_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sideSlot: {
    position: 'absolute',
    height: MAP_MOMENTS_BAR_HEIGHT,
    width: MAP_STACK_BUTTON_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sideRight: {
    right: MAP_STACK_BUTTON_RIGHT,
  },
  shadowWrap: {
    borderRadius: MAP_MOMENTS_BAR_HEIGHT / 2,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.16,
        shadowRadius: 14,
      },
      android: { elevation: 10 },
    }),
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    height: MAP_MOMENTS_BAR_HEIGHT,
    paddingHorizontal: H_PADDING,
    borderRadius: MAP_MOMENTS_BAR_HEIGHT / 2,
    overflow: 'hidden',
  },
  tab: {
    width: TAB_SIZE,
    height: MAP_MOMENTS_BAR_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
