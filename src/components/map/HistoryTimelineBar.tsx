import {useCallback, useMemo, useState} from 'react';
import {
  type LayoutChangeEvent,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {ChevronLeft, ChevronRight} from 'lucide-react-native';

import type {DayTimelineEntry} from '@/lib/trip-detection';
import {
  getTodayDateKey,
  shiftDateKey,
} from '@/lib/day-utils';
import {
  buildHistoryDayRuler,
  formatHistoryDayTitle,
  HISTORY_COLORS,
  historySegmentColor,
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

type HistoryTimelineBarProps = {
  dateKey: string;
  entries: DayTimelineEntry[];
  selectedIndex: number;
  onSelectIndex: (index: number) => void;
  onDateKeyChange: (dateKey: string) => void;
  onOpenDatePicker: () => void;
};

export function HistoryTimelineBar({
  dateKey,
  entries,
  selectedIndex,
  onSelectIndex,
  onDateKeyChange,
  onOpenDatePicker,
}: HistoryTimelineBarProps) {
  const [barWidth, setBarWidth] = useState(FALLBACK_BAR_WIDTH);
  const now = useMemo(() => new Date(), []);

  const ruler = useMemo(
    () => buildHistoryDayRuler(entries, dateKey, barWidth, now),
    [barWidth, dateKey, entries, now],
  );

  const dayTitle = formatHistoryDayTitle(dateKey, now);
  const isToday = dateKey === getTodayDateKey();
  const canGoNextDay = !isToday;
  const hasEntries = entries.length > 0;

  const trackTop = LABEL_HEIGHT + TICK_BAND_HEIGHT;
  const barHeight = trackTop + TRACK_HEIGHT;

  const handleTrackLayout = useCallback((event: LayoutChangeEvent) => {
    const {width} = event.nativeEvent.layout;
    if (width > 0) {
      setBarWidth(width);
    }
  }, []);

  const goPrevDay = useCallback(() => {
    onDateKeyChange(shiftDateKey(dateKey, -1));
  }, [dateKey, onDateKeyChange]);

  const goNextDay = useCallback(() => {
    if (canGoNextDay) {
      onDateKeyChange(shiftDateKey(dateKey, 1));
    }
  }, [canGoNextDay, dateKey, onDateKeyChange]);

  const goPrevEvent = useCallback(() => {
    if (!hasEntries) {
      return;
    }
    if (selectedIndex < 0) {
      onSelectIndex(entries.length - 1);
      return;
    }
    if (selectedIndex > 0) {
      onSelectIndex(selectedIndex - 1);
    }
  }, [entries.length, hasEntries, onSelectIndex, selectedIndex]);

  const goNextEvent = useCallback(() => {
    if (!hasEntries) {
      return;
    }
    if (selectedIndex < 0) {
      onSelectIndex(0);
      return;
    }
    if (selectedIndex < entries.length - 1) {
      onSelectIndex(selectedIndex + 1);
    }
  }, [entries.length, hasEntries, onSelectIndex, selectedIndex]);

  const canGoPrevEvent =
    hasEntries && (selectedIndex < 0 || selectedIndex > 0);
  const canGoNextEvent =
    hasEntries &&
    (selectedIndex < 0 || selectedIndex < entries.length - 1);

  return (
    <View style={styles.wrap}>
      <View style={styles.dayNav}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Previous day"
          onPress={goPrevDay}
          style={styles.dayNavBtn}>
          <ChevronLeft size={20} color={HISTORY_COLORS.playhead} />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${dayTitle}, choose date`}
          onPress={onOpenDatePicker}
          style={styles.dayTitleBtn}>
          <Text style={styles.dayTitle}>{dayTitle}</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Next day"
          disabled={!canGoNextDay}
          onPress={goNextDay}
          style={[styles.dayNavBtn, !canGoNextDay && styles.dayNavBtnDisabled]}>
          <ChevronRight size={20} color={HISTORY_COLORS.playhead} />
        </Pressable>
      </View>

      <View style={[styles.barRow, {height: barHeight}]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Previous event"
          disabled={!canGoPrevEvent}
          onPress={goPrevEvent}
          style={[styles.eventNavBtn, !canGoPrevEvent && styles.eventNavBtnDisabled]}>
          <View style={styles.eventNavCircle}>
            <ChevronLeft
              size={EVENT_NAV_ICON_SIZE}
              color={HISTORY_COLORS.playhead}
              strokeWidth={2.5}
            />
          </View>
        </Pressable>

        <View
          collapsable={false}
          onLayout={handleTrackLayout}
          style={[styles.trackArea, {height: barHeight}]}>
          <View
            pointerEvents="none"
            style={[styles.labelRow, styles.fullWidth, {height: LABEL_HEIGHT}]}>
            {ruler.ticks
              .filter(tick => tick.label != null)
              .map(tick => (
                <Text
                  key={`label-${tick.hour}`}
                  style={[styles.majorLabel, {left: tick.leftPx - 18}]}>
                  {tick.label}
                </Text>
              ))}
          </View>

          <View
            pointerEvents="none"
            style={[
              styles.tickBand,
              styles.fullWidth,
              {height: TICK_BAND_HEIGHT, top: LABEL_HEIGHT},
            ]}>
            {ruler.ticks.map(tick => (
              <View
                key={`tick-${tick.hour}`}
                style={[
                  tick.kind === 'major' ? styles.tickMajor : styles.tickMinor,
                  {left: tick.leftPx},
                ]}
              />
            ))}
          </View>

          <View
            style={[
              styles.trackRow,
              styles.fullWidth,
              {height: TRACK_HEIGHT, top: trackTop},
            ]}>
            <View pointerEvents="none" style={[styles.track, styles.fullWidth]} />
            {ruler.segments.map((segment, segmentIndex) => {
              const selected = segment.entryIndex === selectedIndex;
              const color = historySegmentColor(segment.kind, selected);
              const isFirst = segmentIndex === 0;
              const isLast = segmentIndex === ruler.segments.length - 1;
              const segmentHeight = selected
                ? TRACK_HEIGHT + SELECTED_SEGMENT_LIFT * 2
                : TRACK_HEIGHT;
              const edgeRadius = segmentHeight / 2;

              return (
                <Pressable
                  key={`${segment.entryIndex}-${segment.startAt.getTime()}`}
                  accessibilityRole="button"
                  accessibilityState={{selected}}
                  onPress={() => onSelectIndex(segment.entryIndex)}
                  style={[
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
                  ]}
                />
              );
            })}
          </View>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Next event"
          disabled={!canGoNextEvent}
          onPress={goNextEvent}
          style={[styles.eventNavBtn, !canGoNextEvent && styles.eventNavBtnDisabled]}>
          <View style={styles.eventNavCircle}>
            <ChevronRight
              size={EVENT_NAV_ICON_SIZE}
              color={HISTORY_COLORS.playhead}
              strokeWidth={2.5}
            />
          </View>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: HORIZONTAL_PADDING,
    paddingTop: 2,
    paddingBottom: 8,
  },
  dayNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  dayNavBtn: {
    padding: 8,
    minWidth: 40,
    alignItems: 'center',
  },
  dayNavBtnDisabled: {
    opacity: 0.25,
  },
  dayTitleBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 4,
  },
  dayTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: HISTORY_COLORS.playhead,
  },
  barRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  eventNavBtn: {
    width: EVENT_NAV_BTN_WIDTH,
    height: TRACK_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eventNavCircle: {
    width: EVENT_NAV_CIRCLE_SIZE,
    height: EVENT_NAV_CIRCLE_SIZE,
    borderRadius: EVENT_NAV_CIRCLE_SIZE / 2,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: HISTORY_COLORS.trackEdge,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 3,
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
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.16,
    shadowRadius: 2,
    elevation: 2,
  },
});
