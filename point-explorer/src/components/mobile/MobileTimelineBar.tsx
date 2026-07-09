import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  buildHistoryDayRuler,
  historySegmentColor,
  HISTORY_COLORS,
} from '../../mobile/history-ruler';
import {
  findNextPlayableTimelineIndex,
  findPrevPlayableTimelineIndex,
  firstPlayableTimelineIndex,
  lastPlayableTimelineIndex,
} from '../../mobile/timeline-nav';
import type { DayTimelineEntry } from '../../mobile/types';

type MobileTimelineBarProps = {
  dateKey: string;
  entries: readonly DayTimelineEntry[];
  selectedIndex: number;
  onSelectIndex: (index: number) => void;
};

const EVENT_NAV_BTN_WIDTH = 44;
const TRACK_HEIGHT = 36;
const LABEL_HEIGHT = 14;
const TICK_BAND_HEIGHT = 12;
const SELECTED_SEGMENT_LIFT = 4;
const FALLBACK_BAR_WIDTH = 260;

export function MobileTimelineBar({
  dateKey,
  entries,
  selectedIndex,
  onSelectIndex,
}: MobileTimelineBarProps) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [barWidth, setBarWidth] = useState(FALLBACK_BAR_WIDTH);
  const now = useMemo(() => new Date(), []);

  const ruler = useMemo(
    () => buildHistoryDayRuler(entries, dateKey, barWidth, now),
    [barWidth, dateKey, entries, now],
  );

  const hasEntries = entries.length > 0;
  const trackTop = LABEL_HEIGHT + TICK_BAND_HEIGHT;
  const barHeight = trackTop + TRACK_HEIGHT;

  useEffect(() => {
    const node = trackRef.current;
    if (node == null) {
      return;
    }
    const update = () => {
      const width = node.clientWidth;
      if (width > 0) {
        setBarWidth(width);
      }
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const goPrev = useCallback(() => {
    if (!hasEntries) return;
    const target =
      selectedIndex < 0
        ? lastPlayableTimelineIndex(entries)
        : findPrevPlayableTimelineIndex(entries, selectedIndex);
    if (target >= 0) onSelectIndex(target);
  }, [entries, hasEntries, onSelectIndex, selectedIndex]);

  const goNext = useCallback(() => {
    if (!hasEntries) return;
    const target =
      selectedIndex < 0
        ? firstPlayableTimelineIndex(entries)
        : findNextPlayableTimelineIndex(entries, selectedIndex);
    if (target >= 0) onSelectIndex(target);
  }, [entries, hasEntries, onSelectIndex, selectedIndex]);

  const canGoPrev =
    hasEntries &&
    (selectedIndex < 0
      ? lastPlayableTimelineIndex(entries) >= 0
      : findPrevPlayableTimelineIndex(entries, selectedIndex) >= 0);
  const canGoNext =
    hasEntries &&
    (selectedIndex < 0
      ? firstPlayableTimelineIndex(entries) >= 0
      : findNextPlayableTimelineIndex(entries, selectedIndex) >= 0);

  return (
    <div className="mobile-timeline-bar" style={{ height: barHeight }}>
      <button
        type="button"
        className="mobile-timeline-nav"
        disabled={!canGoPrev}
        aria-label="Previous event"
        onClick={goPrev}
      >
        <span className="mobile-timeline-nav-circle">‹</span>
      </button>

      <div
        className="mobile-timeline-track-area"
        ref={trackRef}
        style={{ height: barHeight }}
      >
        <div
          className="mobile-timeline-label-row"
          style={{ height: LABEL_HEIGHT }}
        >
          {ruler.ticks
            .filter(tick => tick.label != null)
            .map(tick => (
              <span
                key={`label-${tick.hour}`}
                className="mobile-timeline-major-label"
                style={{ left: tick.leftPx - 18 }}
              >
                {tick.label}
              </span>
            ))}
        </div>

        <div
          className="mobile-timeline-tick-band"
          style={{ height: TICK_BAND_HEIGHT, top: LABEL_HEIGHT }}
        >
          {ruler.ticks.map(tick => (
            <span
              key={`tick-${tick.hour}`}
              className={
                tick.kind === 'major'
                  ? 'mobile-timeline-tick-major'
                  : 'mobile-timeline-tick-minor'
              }
              style={{ left: tick.leftPx }}
            />
          ))}
        </div>

        <div
          className="mobile-timeline-track-row"
          style={{ height: TRACK_HEIGHT, top: trackTop }}
        >
          <div className="mobile-timeline-track-bg" />
          {ruler.segments.map((segment, segmentIndex) => {
            const selected = segment.entryIndex === selectedIndex;
            const isFirst = segmentIndex === 0;
            const isLast = segmentIndex === ruler.segments.length - 1;
            const segmentHeight = selected
              ? TRACK_HEIGHT + SELECTED_SEGMENT_LIFT * 2
              : TRACK_HEIGHT;
            const edgeRadius = segmentHeight / 2;
            return (
              <button
                key={`${segment.entryIndex}-${segment.startAt.getTime()}`}
                type="button"
                className={
                  selected
                    ? 'mobile-timeline-segment is-selected'
                    : 'mobile-timeline-segment'
                }
                style={{
                  left: segment.leftPx,
                  width: segment.widthPx,
                  top: selected ? -SELECTED_SEGMENT_LIFT : 0,
                  height: segmentHeight,
                  background: historySegmentColor(segment.kind, selected),
                  borderTopLeftRadius: isFirst ? edgeRadius : 0,
                  borderBottomLeftRadius: isFirst ? edgeRadius : 0,
                  borderTopRightRadius: isLast ? edgeRadius : 0,
                  borderBottomRightRadius: isLast ? edgeRadius : 0,
                }}
                aria-label={`Select ${segment.kind}`}
                onClick={() => onSelectIndex(segment.entryIndex)}
              />
            );
          })}
        </div>
      </div>

      <button
        type="button"
        className="mobile-timeline-nav"
        disabled={!canGoNext}
        aria-label="Next event"
        onClick={goNext}
      >
        <span className="mobile-timeline-nav-circle">›</span>
      </button>
    </div>
  );
}

export { HISTORY_COLORS, EVENT_NAV_BTN_WIDTH };
