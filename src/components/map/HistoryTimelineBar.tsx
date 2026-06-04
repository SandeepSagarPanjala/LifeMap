import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  type GestureResponderEvent,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {ChevronLeft, ChevronRight} from 'lucide-react-native';

import type {DayTimelineEntry} from '@/lib/trip-detection';
import {
  ANCHOR_SIZE_PX,
  buildHistoryDayRulers,
  clampAnchorPx,
  HISTORY_COLORS,
  selectionAtAnchorPx,
  type HistoryDayRuler,
  type HistoryTimeRange,
} from '@/lib/history-timeline';

const HORIZONTAL_PADDING = 16;
const SWIPE_DAY_THRESHOLD_PX = 56;
const TRACK_HEIGHT = 36;
const LABEL_HEIGHT = 14;
const TICK_BAND_HEIGHT = 12;
const FALLBACK_BAR_WIDTH = 320;

type BarMeasure = {
  width: number;
  pageX: number;
};

type HistoryTimelineBarProps = {
  range: HistoryTimeRange;
  entries: DayTimelineEntry[];
  selectedIndex: number;
  onSelectIndex: (index: number) => void;
  focusOnToday?: boolean;
};

export function HistoryTimelineBar({
  range,
  entries,
  selectedIndex,
  onSelectIndex,
  focusOnToday = false,
}: HistoryTimelineBarProps) {
  const scrubRef = useRef<View>(null);
  const [barMeasure, setBarMeasure] = useState<BarMeasure | null>(null);
  const barWidth = barMeasure?.width ?? FALLBACK_BAR_WIDTH;
  const now = useMemo(() => new Date(), [entries, range.endAt.getTime()]);

  const dayRulers = useMemo(
    () => buildHistoryDayRulers(entries, range, barWidth, now),
    [barWidth, entries, range, now],
  );

  const [dayIndex, setDayIndex] = useState(() =>
    Math.max(0, dayRulers.length - 1),
  );
  const [anchorPx, setAnchorPx] = useState(barWidth / 2);
  const isDraggingRef = useRef(false);
  const hasManualScrubRef = useRef(false);
  const initialSnapDoneRef = useRef(false);
  const prevFocusOnTodayRef = useRef(false);

  const ruler = dayRulers[dayIndex] ?? null;
  const trackTop = LABEL_HEIGHT + TICK_BAND_HEIGHT;
  const scrubHeight = trackTop + TRACK_HEIGHT;

  const syncBarMeasure = useCallback(() => {
    scrubRef.current?.measureInWindow((pageX, _pageY, width) => {
      if (width <= 0) {
        return;
      }
      setBarMeasure(prev => {
        if (prev?.width === width && prev.pageX === pageX) {
          return prev;
        }
        return {width, pageX};
      });
    });
  }, []);

  const touchPageXToBarPx = useCallback(
    (event: GestureResponderEvent): number => {
      const {pageX} = event.nativeEvent;
      if (barMeasure) {
        return pageX - barMeasure.pageX;
      }
      return event.nativeEvent.locationX;
    },
    [barMeasure],
  );

  const applyAnchorPx = useCallback(
    (px: number) => {
      if (!ruler) {
        return;
      }
      const clamped = clampAnchorPx(px, barWidth);
      setAnchorPx(clamped);
      onSelectIndex(selectionAtAnchorPx(ruler, clamped, entries));
    },
    [barWidth, entries, onSelectIndex, ruler],
  );

  useEffect(() => {
    if (dayRulers.length === 0 || !ruler) {
      return;
    }
    if (focusOnToday) {
      setDayIndex(dayRulers.length - 1);
    }
  }, [dayRulers.length, focusOnToday, ruler]);

  useEffect(() => {
    if (focusOnToday && !prevFocusOnTodayRef.current) {
      initialSnapDoneRef.current = false;
      hasManualScrubRef.current = false;
    }
    if (!focusOnToday && !prevFocusOnTodayRef.current) {
      hasManualScrubRef.current = false;
      initialSnapDoneRef.current = false;
    }
    prevFocusOnTodayRef.current = focusOnToday;
  }, [focusOnToday]);

  useEffect(() => {
    const day = dayRulers[dayIndex];
    if (
      !day ||
      isDraggingRef.current ||
      hasManualScrubRef.current ||
      !focusOnToday ||
      initialSnapDoneRef.current
    ) {
      return;
    }

    const px =
      day.nowLeftPx ??
      (day.segments.length > 0
        ? day.segments[day.segments.length - 1]!.leftPx +
          day.segments[day.segments.length - 1]!.widthPx / 2
        : barWidth / 2);
    applyAnchorPx(px);
    initialSnapDoneRef.current = true;
  }, [applyAnchorPx, barWidth, dayIndex, dayRulers, focusOnToday]);

  const prevDayIndexRef = useRef(dayIndex);

  useEffect(() => {
    if (prevDayIndexRef.current === dayIndex) {
      return;
    }
    prevDayIndexRef.current = dayIndex;
    const day = dayRulers[dayIndex];
    if (!day || isDraggingRef.current) {
      return;
    }
    const px =
      day.nowLeftPx ??
      (day.segments.length > 0
        ? day.segments[day.segments.length - 1]!.leftPx +
          day.segments[day.segments.length - 1]!.widthPx / 2
        : barWidth / 2);
    applyAnchorPx(px);
  }, [applyAnchorPx, barWidth, dayIndex, dayRulers]);

  const grantPageX = useRef(0);

  const handleGrant = useCallback(
    (event: GestureResponderEvent) => {
      syncBarMeasure();
      isDraggingRef.current = true;
      hasManualScrubRef.current = true;
      grantPageX.current = event.nativeEvent.pageX;
      applyAnchorPx(touchPageXToBarPx(event));
    },
    [applyAnchorPx, syncBarMeasure, touchPageXToBarPx],
  );

  const handleMove = useCallback(
    (event: GestureResponderEvent) => {
      isDraggingRef.current = true;
      hasManualScrubRef.current = true;
      applyAnchorPx(touchPageXToBarPx(event));
    },
    [applyAnchorPx, touchPageXToBarPx],
  );

  const handleRelease = useCallback(
    (event: GestureResponderEvent) => {
      isDraggingRef.current = false;
      hasManualScrubRef.current = true;
      const delta = event.nativeEvent.pageX - grantPageX.current;
      if (Math.abs(delta) >= SWIPE_DAY_THRESHOLD_PX) {
        if (delta < 0 && dayIndex < dayRulers.length - 1) {
          setDayIndex(dayIndex + 1);
        } else if (delta > 0 && dayIndex > 0) {
          setDayIndex(dayIndex - 1);
        }
        return;
      }
      applyAnchorPx(touchPageXToBarPx(event));
    },
    [applyAnchorPx, dayIndex, dayRulers.length, touchPageXToBarPx],
  );

  const goPrevDay = useCallback(() => {
    setDayIndex(index => Math.max(0, index - 1));
  }, []);

  const goNextDay = useCallback(() => {
    setDayIndex(index => Math.min(dayRulers.length - 1, index + 1));
  }, [dayRulers.length]);

  if (!ruler || dayRulers.length === 0) {
    return (
      <View style={styles.wrap}>
        <Text style={styles.emptyHint}>No days in your history yet.</Text>
      </View>
    );
  }

  const anchorLeft = clampAnchorPx(anchorPx, barWidth);
  const anchorTop = trackTop + TRACK_HEIGHT / 2 - ANCHOR_SIZE_PX / 2;

  return (
    <View style={styles.wrap}>
      <View style={styles.dayNav}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Previous day"
          disabled={dayIndex <= 0}
          onPress={goPrevDay}
          style={[styles.dayNavBtn, dayIndex <= 0 && styles.dayNavBtnDisabled]}>
          <ChevronLeft size={20} color={HISTORY_COLORS.playhead} />
        </Pressable>
        <Text style={styles.dayTitle}>{ruler.label}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Next day"
          disabled={dayIndex >= dayRulers.length - 1}
          onPress={goNextDay}
          style={[
            styles.dayNavBtn,
            dayIndex >= dayRulers.length - 1 && styles.dayNavBtnDisabled,
          ]}>
          <ChevronRight size={20} color={HISTORY_COLORS.playhead} />
        </Pressable>
      </View>

      <View
        ref={scrubRef}
        collapsable={false}
        onLayout={syncBarMeasure}
        style={[
          styles.scrubArea,
          {width: barWidth, height: scrubHeight},
        ]}>
        <View pointerEvents="none" style={[styles.labelRow, {width: barWidth, height: LABEL_HEIGHT}]}>
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
            {width: barWidth, height: TICK_BAND_HEIGHT, top: LABEL_HEIGHT},
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
          pointerEvents="none"
          style={[
            styles.trackRow,
            {width: barWidth, height: TRACK_HEIGHT, top: trackTop},
          ]}>
          <View style={[styles.track, {width: barWidth}]} />
          {ruler.segments.map(segment => {
            const color =
              segment.kind === 'stay'
                ? HISTORY_COLORS.stay
                : segment.kind === 'travel'
                  ? HISTORY_COLORS.travel
                  : HISTORY_COLORS.gap;
            const selected = segment.entryIndex === selectedIndex;
            const edgeRadius = TRACK_HEIGHT / 2;
            const atLeftEdge = segment.leftPx <= 0.5;
            const atRightEdge =
              segment.leftPx + segment.widthPx >= barWidth - 0.5;

            return (
              <View
                key={`${segment.entryIndex}-${segment.startAt.getTime()}`}
                style={[
                  styles.fill,
                  {
                    left: segment.leftPx,
                    width: segment.widthPx,
                    backgroundColor: color,
                    opacity: selected ? 1 : 0.88,
                    borderTopLeftRadius: atLeftEdge ? edgeRadius : 4,
                    borderBottomLeftRadius: atLeftEdge ? edgeRadius : 4,
                    borderTopRightRadius: atRightEdge ? edgeRadius : 4,
                    borderBottomRightRadius: atRightEdge ? edgeRadius : 4,
                  },
                ]}
              />
            );
          })}
          {ruler.nowLeftPx != null ? (
            <View style={[styles.nowLine, {left: ruler.nowLeftPx}]} />
          ) : null}
        </View>

        <View
          pointerEvents="none"
          style={[
            styles.anchorStem,
            {left: anchorLeft, top: trackTop, height: TRACK_HEIGHT},
          ]}
        />
        <View
          pointerEvents="none"
          style={[
            styles.anchor,
            {left: anchorLeft - ANCHOR_SIZE_PX / 2, top: anchorTop},
          ]}
        />

        <View
          style={[styles.touchLayer, {width: barWidth, height: scrubHeight}]}
          onStartShouldSetResponder={() => true}
          onMoveShouldSetResponder={() => true}
          onResponderTerminationRequest={() => false}
          onResponderGrant={handleGrant}
          onResponderMove={handleMove}
          onResponderRelease={handleRelease}
          onResponderTerminate={handleRelease}
        />
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
  dayTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: HISTORY_COLORS.playhead,
  },
  emptyHint: {
    fontSize: 11,
    color: HISTORY_COLORS.tickLabel,
    textAlign: 'center',
  },
  scrubArea: {
    position: 'relative',
    alignSelf: 'center',
  },
  touchLayer: {
    position: 'absolute',
    left: 0,
    top: 0,
    zIndex: 10,
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
  nowLine: {
    position: 'absolute',
    top: 0,
    width: 2,
    height: TRACK_HEIGHT,
    backgroundColor: HISTORY_COLORS.nowMarker,
    zIndex: 2,
    marginLeft: -1,
  },
  anchorStem: {
    position: 'absolute',
    width: 2,
    marginLeft: -1,
    backgroundColor: HISTORY_COLORS.playhead,
    zIndex: 3,
  },
  anchor: {
    position: 'absolute',
    width: ANCHOR_SIZE_PX,
    height: ANCHOR_SIZE_PX,
    borderRadius: ANCHOR_SIZE_PX / 2,
    backgroundColor: HISTORY_COLORS.anchor,
    borderWidth: 2.5,
    borderColor: HISTORY_COLORS.anchorBorder,
    zIndex: 4,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 5,
  },
});
