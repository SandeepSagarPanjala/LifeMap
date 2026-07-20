import { memo, useCallback, useMemo, useState } from 'react';
import {
  type LayoutChangeEvent,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';

import type { DayTimelineEntry } from '@/lib/trip-detection';
import { CAPTURE_BUTTON_THEMES } from '@/components/map/map-capture-button-theme';
import {
  findNextNavigableTimelineIndex,
  findPrevNavigableTimelineIndex,
  firstNavigableTimelineIndex,
  lastNavigableTimelineIndex,
} from '@/lib/trip-detection';
import { HISTORY_COLORS } from '@/lib/app-constants';
import {
  buildHistoryDayRuler,
  historySegmentColor,
  type HistoryDaySegment,
} from '@/lib/history-timeline';

const HORIZONTAL_PADDING = 16;
const EVENT_NAV_BTN_WIDTH = 44;
const EVENT_NAV_CIRCLE_SIZE = 36;
const EVENT_NAV_ICON_SIZE = 20;
const TRACK_HEIGHT = 36;
const LABEL_HEIGHT = 14;
const TICK_BAND_HEIGHT = 12;
const FALLBACK_BAR_WIDTH = 260;
/** Selected segment rises slightly above the track. */
const SELECTED_SEGMENT_LIFT = 4;
const HISTORY_EVENT_NAV_THEME = CAPTURE_BUTTON_THEMES.camera;

type HistoryTimelineBarProps = {
  dateKey: string;
  entries: DayTimelineEntry[];
  selectedIndex: number;
  onSelectIndex: (index: number) => void;
  /** Past days: wrap to previous day when on the first event. */
  canWrapToPrevDay?: boolean;
  /** Past days only (not today): wrap to next day when on the last event. */
  canWrapToNextDay?: boolean;
  onWrapToPrevDay?: () => void;
  onWrapToNextDay?: () => void;
};

const TimelineSegmentButton = memo(function TimelineSegmentButton({
  segment,
  selected,
  isFirst,
  isLast,
  onSelectIndex,
}: {
  segment: HistoryDaySegment;
  selected: boolean;
  isFirst: boolean;
  isLast: boolean;
  onSelectIndex: (index: number) => void;
}) {
  const color = historySegmentColor(segment.kind, selected);
  const segmentHeight = selected
    ? TRACK_HEIGHT + SELECTED_SEGMENT_LIFT * 2
    : TRACK_HEIGHT;
  const edgeRadius = segmentHeight / 2;
  const handlePress = useCallback(() => {
    onSelectIndex(segment.entryIndex);
  }, [onSelectIndex, segment.entryIndex]);
  const segmentStyle = useMemo(
    () => [
      styles.fill,
      selected && styles.fillSelected,
      {
        left: segment.leftPx,
        width: segment.widthPx,
        top: selected ? -SELECTED_SEGMENT_LIFT : 0,
        height: segmentHeight,
        backgroundColor: color,
        borderTopLeftRadius: isFirst ? edgeRadius : 0,
        borderBottomLeftRadius: isFirst ? edgeRadius : 0,
        borderTopRightRadius: isLast ? edgeRadius : 0,
        borderBottomRightRadius: isLast ? edgeRadius : 0,
        borderWidth: selected ? 2 : 0,
        borderColor: selected
          ? HISTORY_COLORS.segmentSelectedBorder
          : 'transparent',
      },
    ],
    [
      color,
      edgeRadius,
      isFirst,
      isLast,
      segment.leftPx,
      segment.widthPx,
      segmentHeight,
      selected,
    ],
  );

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={handlePress}
      style={segmentStyle}
    />
  );
});

export const HistoryTimelineBar = memo(function HistoryTimelineBar({
  dateKey,
  entries,
  selectedIndex,
  onSelectIndex,
  canWrapToPrevDay = false,
  canWrapToNextDay = false,
  onWrapToPrevDay,
  onWrapToNextDay,
}: HistoryTimelineBarProps) {
  const [barWidth, setBarWidth] = useState(FALLBACK_BAR_WIDTH);
  const now = useMemo(() => new Date(), []);

  const ruler = useMemo(
    () => buildHistoryDayRuler(entries, dateKey, barWidth, now),
    [barWidth, dateKey, entries, now],
  );

  const hasEntries = entries.length > 0;

  const trackTop = LABEL_HEIGHT + TICK_BAND_HEIGHT;
  const barHeight = trackTop + TRACK_HEIGHT;

  const handleTrackLayout = useCallback((event: LayoutChangeEvent) => {
    const { width } = event.nativeEvent.layout;
    if (width > 0) {
      setBarWidth(width);
    }
  }, []);

  const firstNavigable = firstNavigableTimelineIndex(entries);
  const lastNavigable = lastNavigableTimelineIndex(entries);
  const sameDayPrev =
    hasEntries &&
    (selectedIndex < 0
      ? lastNavigable >= 0
      : findPrevNavigableTimelineIndex(entries, selectedIndex) >= 0);
  const sameDayNext =
    hasEntries &&
    (selectedIndex < 0
      ? firstNavigable >= 0
      : findNextNavigableTimelineIndex(entries, selectedIndex) >= 0);
  const canGoPrevEvent = sameDayPrev || canWrapToPrevDay;
  const canGoNextEvent = sameDayNext || canWrapToNextDay;

  const goPrevEvent = useCallback(() => {
    if (hasEntries) {
      const target =
        selectedIndex < 0
          ? lastNavigableTimelineIndex(entries)
          : findPrevNavigableTimelineIndex(entries, selectedIndex);
      if (target >= 0) {
        onSelectIndex(target);
        return;
      }
    }
    if (canWrapToPrevDay) {
      onWrapToPrevDay?.();
    }
  }, [
    canWrapToPrevDay,
    entries,
    hasEntries,
    onSelectIndex,
    onWrapToPrevDay,
    selectedIndex,
  ]);

  const goNextEvent = useCallback(() => {
    if (hasEntries) {
      const target =
        selectedIndex < 0
          ? firstNavigableTimelineIndex(entries)
          : findNextNavigableTimelineIndex(entries, selectedIndex);
      if (target >= 0) {
        onSelectIndex(target);
        return;
      }
    }
    if (canWrapToNextDay) {
      onWrapToNextDay?.();
    }
  }, [
    canWrapToNextDay,
    entries,
    hasEntries,
    onSelectIndex,
    onWrapToNextDay,
    selectedIndex,
  ]);

  return (
    <View style={styles.wrap}>
      <View style={[styles.barRow, { height: barHeight }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Previous event"
          disabled={!canGoPrevEvent}
          onPress={goPrevEvent}
          style={[
            styles.eventNavBtn,
            { height: barHeight },
            !canGoPrevEvent && styles.eventNavBtnDisabled,
          ]}
        >
          <View style={styles.eventNavCircle}>
            <ChevronLeft
              size={EVENT_NAV_ICON_SIZE}
              color={HISTORY_EVENT_NAV_THEME.icon}
              strokeWidth={2.5}
            />
          </View>
        </Pressable>

        <View
          collapsable={false}
          onLayout={handleTrackLayout}
          style={[styles.trackArea, { height: barHeight }]}
        >
          <View
            pointerEvents="none"
            style={[
              styles.labelRow,
              styles.fullWidth,
              { height: LABEL_HEIGHT },
            ]}
          >
            {ruler.ticks
              .filter(tick => tick.label != null)
              .map(tick => (
                <Text
                  key={`label-${tick.hour}`}
                  style={[styles.majorLabel, { left: tick.leftPx - 18 }]}
                >
                  {tick.label}
                </Text>
              ))}
          </View>

          <View
            pointerEvents="none"
            style={[
              styles.tickBand,
              styles.fullWidth,
              { height: TICK_BAND_HEIGHT, top: LABEL_HEIGHT },
            ]}
          >
            {ruler.ticks.map(tick => (
              <View
                key={`tick-${tick.hour}`}
                style={[
                  tick.kind === 'major' ? styles.tickMajor : styles.tickMinor,
                  { left: tick.leftPx },
                ]}
              />
            ))}
          </View>

          <View
            style={[
              styles.trackRow,
              styles.fullWidth,
              { height: TRACK_HEIGHT, top: trackTop },
            ]}
          >
            <View
              pointerEvents="none"
              style={[styles.track, styles.fullWidth]}
            />
            {ruler.segments.map((segment, segmentIndex) => (
              <TimelineSegmentButton
                key={`${segment.entryIndex}-${segment.startAt.getTime()}`}
                segment={segment}
                selected={segment.entryIndex === selectedIndex}
                isFirst={segmentIndex === 0}
                isLast={segmentIndex === ruler.segments.length - 1}
                onSelectIndex={onSelectIndex}
              />
            ))}
          </View>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Next event"
          disabled={!canGoNextEvent}
          onPress={goNextEvent}
          style={[
            styles.eventNavBtn,
            { height: barHeight },
            !canGoNextEvent && styles.eventNavBtnDisabled,
          ]}
        >
          <View style={styles.eventNavCircle}>
            <ChevronRight
              size={EVENT_NAV_ICON_SIZE}
              color={HISTORY_EVENT_NAV_THEME.icon}
              strokeWidth={2.5}
            />
          </View>
        </Pressable>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: HORIZONTAL_PADDING,
    paddingTop: 2,
    paddingBottom: 8,
  },
  barRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  eventNavBtn: {
    width: EVENT_NAV_BTN_WIDTH,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  eventNavCircle: {
    width: EVENT_NAV_CIRCLE_SIZE,
    height: EVENT_NAV_CIRCLE_SIZE,
    borderRadius: EVENT_NAV_CIRCLE_SIZE / 2,
    backgroundColor: HISTORY_EVENT_NAV_THEME.badgeBg,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  eventNavBtnDisabled: {
    opacity: 0.35,
  },
  trackArea: {
    flex: 1,
    position: 'relative',
    marginHorizontal: 4,
  },
  fullWidth: {
    width: '100%',
  },
  labelRow: {
    position: 'relative',
  },
  majorLabel: {
    position: 'absolute',
    top: 0,
    width: 36,
    fontSize: 9,
    fontWeight: '600',
    color: HISTORY_COLORS.tickLabel,
    textAlign: 'center',
  },
  tickBand: {
    position: 'absolute',
    left: 0,
  },
  tickMinor: {
    position: 'absolute',
    bottom: 0,
    width: 1,
    height: 5,
    backgroundColor: HISTORY_COLORS.tickMinor,
  },
  tickMajor: {
    position: 'absolute',
    bottom: 0,
    width: 1.5,
    height: TICK_BAND_HEIGHT,
    backgroundColor: HISTORY_COLORS.tickMajor,
  },
  trackRow: {
    position: 'absolute',
    left: 0,
  },
  track: {
    position: 'absolute',
    left: 0,
    top: 0,
    height: TRACK_HEIGHT,
    backgroundColor: HISTORY_COLORS.track,
    borderRadius: TRACK_HEIGHT / 2,
    borderWidth: 1,
    borderColor: HISTORY_COLORS.trackEdge,
  },
  fill: {
    position: 'absolute',
    top: 0,
    height: TRACK_HEIGHT,
    zIndex: 1,
  },
  fillSelected: {
    zIndex: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.16,
    shadowRadius: 2,
    elevation: 2,
  },
});
