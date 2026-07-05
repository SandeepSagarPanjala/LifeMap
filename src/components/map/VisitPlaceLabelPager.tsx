import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';

import {VisitPlaceLabelWithPin} from '@/components/map/VisitPlaceLabelWithPin';
import {Text} from '@/components/ui/text';
import type {VisitPlaceDisplay} from '@/lib/place-lookup-types';

type VisitPlaceLabelPagerProps = {
  display: VisitPlaceDisplay;
  compact?: boolean;
  onSelectPoiId: (poiId: number, poiLabel: string) => void;
};

const PAGE_WIDTH = 220;
const PAGE_WIDTH_COMPACT = 168;

export function VisitPlaceLabelPager({
  display,
  compact = false,
  onSelectPoiId,
}: VisitPlaceLabelPagerProps) {
  const pageWidth = compact ? PAGE_WIDTH_COMPACT : PAGE_WIDTH;
  const scrollRef = useRef<ScrollView>(null);
  const candidates = display.candidates;
  const selectedIndex = useMemo(() => {
    if (display.selectedPoiId == null) {
      return 0;
    }
    const index = candidates.findIndex(
      candidate => candidate.id === display.selectedPoiId,
    );
    return index >= 0 ? index : 0;
  }, [candidates, display.selectedPoiId]);
  const [pageIndex, setPageIndex] = useState(selectedIndex);

  useEffect(() => {
    setPageIndex(selectedIndex);
  }, [selectedIndex]);

  const handleMomentumEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const nextIndex = Math.round(
        event.nativeEvent.contentOffset.x / pageWidth,
      );
      const clamped = Math.max(0, Math.min(nextIndex, candidates.length - 1));
      setPageIndex(clamped);
      const candidate = candidates[clamped];
      if (candidate && candidate.id !== display.selectedPoiId) {
        onSelectPoiId(candidate.id, candidate.name);
      }
    },
    [candidates, display.selectedPoiId, onSelectPoiId, pageWidth],
  );

  const showUserPin = display.selectedPoiId != null;
  if (display.source !== 'lookup' || candidates.length <= 1) {
    if (!display.primaryLabel) {
      return null;
    }
    return (
      <VisitPlaceLabelWithPin
        name={display.primaryLabel}
        showPin={showUserPin}
      />
    );
  }

  return (
    <View style={[styles.wrap, compact && styles.wrapCompact]}>
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        contentOffset={{x: selectedIndex * pageWidth, y: 0}}
        snapToInterval={pageWidth}
        decelerationRate="fast"
        onMomentumScrollEnd={handleMomentumEnd}
        style={styles.scroll}>
        {candidates.map((candidate, index) => (
          <View
            key={`${candidate.id}-${candidate.name}`}
            style={[styles.page, {width: pageWidth}]}>
            <VisitPlaceLabelWithPin
              name={candidate.name}
              showPin={showUserPin && candidate.id === display.selectedPoiId}
            />
            <Text variant="muted" className="text-[10px] uppercase tracking-wide">
              {candidate.source === 'user' ? 'Custom' : 'Nearby'}
            </Text>
          </View>
        ))}
      </ScrollView>
      <View style={styles.dots}>
        {candidates.map((candidate, index) => (
          <View
            key={`dot-${candidate.id}`}
            style={[styles.dot, index === pageIndex && styles.dotActive]}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexShrink: 1,
    minWidth: 0,
    maxWidth: PAGE_WIDTH,
  },
  wrapCompact: {
    maxWidth: PAGE_WIDTH_COMPACT,
  },
  scroll: {
    flexGrow: 0,
  },
  page: {
    paddingRight: 8,
  },
  dots: {
    flexDirection: 'row',
    gap: 4,
    marginTop: 2,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#D1D1D6',
  },
  dotActive: {
    backgroundColor: '#8E8E93',
  },
});
